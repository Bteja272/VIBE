"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import VibeAvatar from "@/components/vibe-avatar";

import { socket } from "@/src/lib/socket";
import type {
  DirectMessage,
  DmSendResponse,
} from "@/src/types/dm";

interface DmParticipant {
  userId: string;
  displayName: string;
  identityType: "GUEST" | "REGISTERED";
  avatarId?: string;
}

interface RoomDmProps {
  recipient: DmParticipant;
  currentUserId: string;
  messages: DirectMessage[];
  canSend: boolean;
}

const MESSAGE_MAX_LENGTH = 500;
const SOCKET_TIMEOUT_MS = 5000;

export default function RoomDm({
  recipient,
  currentUserId,
  messages,
  canSend,
}: RoomDmProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const messagesContainerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [recipient.userId]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const content = message.trim();

    if (!content || !canSend || sending) {
      return;
    }

    setError(null);
    setSending(true);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "dm:send",
      {
        recipientUserId: recipient.userId,
        content,
      },
      (
        timeoutError: Error | null,
        response?: DmSendResponse,
      ) => {
        setSending(false);

        if (timeoutError) {
          setError(
            "The server did not respond. Please try again.",
          );

          return;
        }

        if (!response?.sent) {
          setError(
            response?.error ??
              "Unable to send direct message",
          );

          return;
        }

        /*
         * Do not append the acknowledgement here.
         *
         * The server emits dm:message back to the
         * sender and recipient. SpatialRoom owns
         * that event and updates the conversation.
         */
        setMessage("");
      },
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-center">
            <div>
              <VibeAvatar
                avatarId={recipient.avatarId}
                size="lg"
              />

              <p className="mt-3 text-sm font-medium text-neutral-300">
                Start a conversation with{" "}
                {recipient.displayName}
              </p>

              <p className="mt-1 text-xs text-neutral-600">
                Messages are temporary and are not
                saved after you leave this room.
              </p>
            </div>
          </div>
        ) : (
          messages.map((item) => {
            const isCurrentUser =
              item.senderUserId === currentUserId;

            return (
              <article
                key={item.id}
                className={`flex ${
                  isCurrentUser
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2.5 ${
                    isCurrentUser
                      ? "bg-neutral-100 text-neutral-950"
                      : "bg-neutral-800 text-neutral-200"
                  }`}
                >
                  {!isCurrentUser && (
                    <p className="mb-1 text-xs font-medium text-neutral-400">
                      {item.senderDisplayName}
                    </p>
                  )}

                  <p className="break-words text-sm leading-6">
                    {item.content}
                  </p>

                  <time
                    className={`mt-1 block text-[10px] ${
                      isCurrentUser
                        ? "text-neutral-500"
                        : "text-neutral-600"
                    }`}
                  >
                    {new Date(
                      item.createdAt,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </article>
            );
          })
        )}
      </div>

      {canSend ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-neutral-800 p-3"
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={`Message ${recipient.displayName}`}
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500"
            />

            <button
              type="submit"
              disabled={
                sending || !message.trim()
              }
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="border-t border-neutral-800 px-4 py-4">
          <p className="text-sm text-neutral-500">
            {recipient.displayName} is no longer in
            the room.
          </p>
        </div>
      )}
    </section>
  );
}