"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import VibeAvatar from "@/components/vibe-avatar";

import { socket } from "@/src/lib/socket";

import type { ChatHistoryResponse, ChatMessage } from "@/src/types/chat";

interface ChatParticipant {
  userId: string;
  displayName: string;

  identityType: "GUEST" | "REGISTERED";

  avatarId?: string;
}

interface RoomChatProps {
  roomId: string;
  canSend: boolean;

  participants?: ChatParticipant[];

  currentUserId?: string | null;

  compact?: boolean;

  onIncomingMessage?: (message: ChatMessage) => void;

  onHistoryLoaded?: (messages: ChatMessage[]) => void;

  prefillText?: string | null;

  prefillRequestId?: number;

  onPrefillConsumed?: () => void;
}

interface MentionQuery {
  start: number;
  query: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMentionQuery(value: string, cursor: number): MentionQuery | null {
  const beforeCursor = value.slice(0, cursor);

  /*
   * Looks for the most recent @ token
   * that has not yet been terminated
   * by whitespace.
   */
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

  if (!match) {
    return null;
  }

  const fullMatch = match[0];

  const atOffset = fullMatch.lastIndexOf("@");

  return {
    start: beforeCursor.length - fullMatch.length + atOffset,

    query: match[1] ?? "",
  };
}

function renderMessageContent(
  content: string,
  participants: ChatParticipant[],
  currentUserId: string | null,
) {
  if (participants.length === 0) {
    return content;
  }

  /*
   * Longest names first prevents:
   *
   * @Sam
   * @Sam Aaron
   *
   * from matching @Sam prematurely.
   */
  const orderedNames = [...participants]
    .map((participant) => ({
      userId: participant.userId,

      displayName: participant.displayName,
    }))
    .filter((participant) => participant.displayName.trim())
    .sort((left, right) => right.displayName.length - left.displayName.length);

  if (orderedNames.length === 0) {
    return content;
  }

  const expression = new RegExp(
    `(@(?:${orderedNames
      .map((participant) => escapeRegExp(participant.displayName))
      .join("|")}))`,
    "g",
  );

  const pieces = content.split(expression);

  return pieces.map((piece, index) => {
    if (!piece.startsWith("@")) {
      return <span key={index}>{piece}</span>;
    }

    const mentionedName = piece.slice(1);

    const participant = orderedNames.find(
      (item) => item.displayName === mentionedName,
    );

    if (!participant) {
      return <span key={index}>{piece}</span>;
    }

    const isCurrentUser = participant.userId === currentUserId;

    return (
      <span
        key={index}
        className={
          isCurrentUser
            ? "rounded bg-neutral-100 px-1 font-medium text-neutral-950"
            : "rounded bg-neutral-800 px-1 font-medium text-neutral-200"
        }
      >
        {piece}
      </span>
    );
  });
}

export default function RoomChat({
  roomId,
  canSend,
  participants = [],
  currentUserId = null,
  compact = false,
  onIncomingMessage,
  onHistoryLoaded,
  prefillText = null,
  prefillRequestId = 0,
  onPrefillConsumed,
}: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [message, setMessage] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);

  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);

  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  /*
 * Allows another spatial-room control
 * to open chat with text already placed
 * in the composer.
 *
 * Example:
 *   @Chaos 
 */
useEffect(() => {
  if (!prefillText || !canSend) {
    return;
  }

  setMessage(prefillText);

  setMentionQuery(null);

  const frame = window.requestAnimationFrame(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();

    const cursor = prefillText.length;

    input.setSelectionRange(cursor, cursor);
  });

  onPrefillConsumed?.();

  return () => {
    window.cancelAnimationFrame(frame);
  };
}, [
  prefillText,
  prefillRequestId,
  canSend,
  onPrefillConsumed,
]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    const query = mentionQuery.query.trim().toLocaleLowerCase();

    return participants
      .filter((participant) => participant.userId !== currentUserId)
      .filter((participant) =>
        participant.displayName.toLocaleLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [mentionQuery, participants, currentUserId]);

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionQuery?.query]);

  useEffect(() => {
    function handleMessage(incoming: ChatMessage) {
      if (incoming.roomId !== roomId) {
        return;
      }

      setMessages((current) => {
        if (current.some((item) => item.id === incoming.id)) {
          return current;
        }

        return [...current, incoming].slice(-50);
      });

      onIncomingMessage?.(incoming);
    }

    function loadHistory() {
      socket.emit(
        "chat:history",
        undefined,
        (response: ChatHistoryResponse) => {
          if (response?.roomId !== roomId) {
            return;
          }

          const history = response.messages ?? [];

          setMessages(history);

          onHistoryLoaded?.(history);
        },
      );
    }

    socket.on("chat:message", handleMessage);

    if (socket.connected) {
      loadHistory();
    }

    socket.on("connect", loadHistory);

    return () => {
      socket.off("chat:message", handleMessage);

      socket.off("connect", loadHistory);
    };
  }, [roomId, onIncomingMessage, onHistoryLoaded]);

  useEffect(() => {
  const container =
    messagesContainerRef.current;

  if (!container) {
    return;
  }

  container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth",
  });
}, [messages]);

  function updateMentionState(value: string, cursor: number | null) {
    if (cursor === null) {
      setMentionQuery(null);

      return;
    }

    setMentionQuery(getMentionQuery(value, cursor));
  }

  function handleInputChange(value: string, cursor: number | null) {
    setMessage(value);

    updateMentionState(value, cursor);
  }

  function insertMention(participant: ChatParticipant) {
    if (!mentionQuery) {
      return;
    }

    const input = inputRef.current;

    const cursor = input?.selectionStart ?? message.length;

    const before = message.slice(0, mentionQuery.start);

    const after = message.slice(cursor);

    const inserted = `@${participant.displayName} `;

    const next = `${before}${inserted}${after}`;

    const nextCursor = before.length + inserted.length;

    setMessage(next);

    setMentionQuery(null);

    window.requestAnimationFrame(() => {
      input?.focus();

      input?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!mentionQuery || mentionSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setSelectedMentionIndex(
        (current) => (current + 1) % mentionSuggestions.length,
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setSelectedMentionIndex(
        (current) =>
          (current - 1 + mentionSuggestions.length) % mentionSuggestions.length,
      );

      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const participant = mentionSuggestions[selectedMentionIndex];

      if (participant) {
        insertMention(participant);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      setMentionQuery(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = message.trim();

    if (!content) {
      return;
    }

    setError(null);

    setSending(true);

    socket.timeout(5000).emit(
      "chat:send",

      {
        content,
      },

      (
        timeoutError: Error | null,

        response?: {
          sent: boolean;
          error?: string;
          message?: ChatMessage;
        },
      ) => {
        setSending(false);

        if (timeoutError) {
          setError("The server did not respond. Please try again.");

          return;
        }

        if (!response?.sent) {
          setError(response?.error ?? "Unable to send message");

          return;
        }

        setMessage("");

        setMentionQuery(null);
      },
    );
  }

  return (
    <section
      className={
        compact
          ? "flex h-full min-h-0 flex-col bg-neutral-950"
          : "rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
      }
    >
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold">Room chat</h2>

          <p className="mt-1 text-sm text-neutral-500">Recent room messages</p>
        </div>
      )}

      <div
      ref={messagesContainerRef}
        className={
          compact
            ? "min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
            : "mt-5 max-h-80 space-y-3 overflow-y-auto"
        }
      >
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet.</p>
        ) : (
          messages.map((item) => {
            const name =
              item.displayName?.trim() || item.userEmail || "Unknown user";

            const isCurrentUser = item.userId === currentUserId;

            return (
              <div
                key={item.id}
                className={`rounded-xl px-3 py-3 ${
                  isCurrentUser ? "bg-neutral-800" : "bg-neutral-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <VibeAvatar avatarId={item.avatarId} size="sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {isCurrentUser ? `${name} · You` : name}
                        </p>

                        {item.identityType && (
                          <p className="text-xs text-neutral-600">
                            {item.identityType === "GUEST"
                              ? "Guest"
                              : "Registered"}
                          </p>
                        )}
                      </div>

                      <time className="text-xs text-neutral-600">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>

                    <p className="mt-2 break-words text-sm leading-6 text-neutral-300">
                      {renderMessageContent(
                        item.content,
                        participants,
                        currentUserId,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canSend ? (
        <form
          onSubmit={handleSubmit}
          className={
            compact
              ? "relative border-t border-neutral-800 p-3"
              : "relative mt-5 flex gap-3"
          }
        >
          {mentionQuery && mentionSuggestions.length > 0 && (
            <div
              className={
                compact
                  ? "absolute bottom-[calc(100%+0.25rem)] left-3 right-3 z-30 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl"
                  : "absolute bottom-[calc(100%+0.5rem)] left-0 z-30 min-w-64 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl"
              }
            >
              <p className="border-b border-neutral-800 px-3 py-2 text-xs text-neutral-500">
                Mention someone
              </p>

              {mentionSuggestions.map((participant, index) => (
                <button
                  key={participant.userId}
                  type="button"
                  onMouseDown={(event) => {
                    /*
                     * Prevent the input
                     * from losing its
                     * cursor position.
                     */
                    event.preventDefault();

                    insertMention(participant);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                    index === selectedMentionIndex
                      ? "bg-neutral-800"
                      : "hover:bg-neutral-800/60"
                  }`}
                >
                  <VibeAvatar avatarId={participant.avatarId} size="sm" />

                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-200">
                      @{participant.displayName}
                    </p>

                    <p className="text-xs text-neutral-600">
                      {participant.identityType === "GUEST"
                        ? "Guest"
                        : "Registered"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={compact ? "flex gap-2" : "flex min-w-0 flex-1 gap-3"}>
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(event) => {
                handleInputChange(
                  event.target.value,
                  event.target.selectionStart,
                );
              }}
              onClick={(event) => {
                updateMentionState(
                  event.currentTarget.value,
                  event.currentTarget.selectionStart,
                );
              }}
              onKeyDown={handleInputKeyDown}
              maxLength={500}
              placeholder="Say something... Use @ to mention"
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500"
            />

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </form>
      ) : (
        <p
          className={
            compact
              ? "border-t border-neutral-800 px-4 py-4 text-sm text-neutral-500"
              : "mt-5 text-sm text-neutral-500"
          }
        >
          Join the room to chat.
        </p>
      )}
    </section>
  );
}
