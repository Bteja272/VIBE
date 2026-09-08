"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import RoomChat from "@/components/room-chat";
import RoomMusic from "@/components/room-music";
import VibeAvatar from "@/components/vibe-avatar";

import {
  buildSpatialSeats,
  reconcileSeatAssignments,
  SPATIAL_SEATS,
  type SpatialParticipant,
} from "@/src/lib/spatial-layout";
import { socket } from "@/src/lib/socket";
import type { ChatMessage } from "@/src/types/chat";

interface SpatialRoomProps {
  roomId: string;
  users: SpatialParticipant[];
  connected: boolean;
  currentUserId?: string | null;
  isOwner?: boolean;
  capacity?: number;
}

interface MentionNotification {
  id: string;
  senderName: string;
  senderAvatarId?: string;
  content: string;
}

interface ActiveBubble {
  messageId: string;
  content: string;
}

interface ChatPrefill {
  text: string;
  requestId: number;
}

const BUBBLE_LIFETIME_MS = 5000;
const MENTION_NOTIFICATION_LIFETIME_MS = 4000;
const BUBBLE_MAX_LENGTH = 70;
const MENTION_PREVIEW_MAX_LENGTH = 90;

function getStorageKey(roomId: string) {
  return `vibe_spatial_seats_${roomId}`;
}

function truncateText(content: string, maxLength: number) {
  const trimmed = content.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function messageMentionsUser(
  message: ChatMessage,
  currentUser: SpatialParticipant | undefined,
) {
  if (!currentUser?.displayName.trim()) {
    return false;
  }

  const escapedName = escapeRegExp(currentUser.displayName.trim());

  const expression = new RegExp(
    `(?:^|\\s)@${escapedName}(?=\\s|$|[.,!?;:])`,
    "i",
  );

  return expression.test(message.content);
}

export default function SpatialRoom({
  roomId,
  users,
  connected,
  currentUserId = null,
  isOwner = false,
  capacity = 12,
}: SpatialRoomProps) {
  const [assignments, setAssignments] =
    useState<Record<string, string>>({});

  const [seatStateLoaded, setSeatStateLoaded] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [openParticipantId, setOpenParticipantId] =
    useState<string | null>(null);

  const [chatPrefill, setChatPrefill] =
    useState<ChatPrefill | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [mentionCount, setMentionCount] = useState(0);

  const [mentionNotification, setMentionNotification] =
    useState<MentionNotification | null>(null);

  const [activeBubbles, setActiveBubbles] =
    useState<Record<string, ActiveBubble>>({});

  const bubbleTimers = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  const currentUser = useMemo(
    () => users.find((user) => user.userId === currentUserId),
    [users, currentUserId],
  );

  const occupiedSeats = useMemo(
    () => new Set(Object.values(assignments)),
    [assignments],
  );

  const renderedSeats = useMemo(
    () => buildSpatialSeats(users, assignments),
    [users, assignments],
  );

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(
        getStorageKey(roomId),
      );

      if (stored) {
        setAssignments(
          JSON.parse(stored) as Record<string, string>,
        );
      }
    } catch {
      // Invalid local seat data should not block room rendering.
    } finally {
      setSeatStateLoaded(true);
    }
  }, [roomId]);

  useEffect(() => {
    if (!seatStateLoaded) {
      return;
    }

    setAssignments((current) =>
      reconcileSeatAssignments(users, current),
    );
  }, [users, seatStateLoaded]);

  useEffect(() => {
    if (!seatStateLoaded) {
      return;
    }

    window.sessionStorage.setItem(
      getStorageKey(roomId),
      JSON.stringify(assignments),
    );
  }, [roomId, assignments, seatStateLoaded]);

  useEffect(() => {
    const timers = bubbleTimers.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!mentionNotification) {
      return;
    }

    const timer = window.setTimeout(
      () => setMentionNotification(null),
      MENTION_NOTIFICATION_LIFETIME_MS,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [mentionNotification]);

  useEffect(() => {
    if (!openParticipantId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest("[data-participant-menu]") ||
        target.closest("[data-participant-menu-trigger]")
      ) {
        return;
      }

      setOpenParticipantId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openParticipantId]);

  useEffect(() => {
    if (
      openParticipantId &&
      !users.some((user) => user.userId === openParticipantId)
    ) {
      setOpenParticipantId(null);
    }
  }, [users, openParticipantId]);

  const handleIncomingMessage = useCallback(
    (incoming: ChatMessage) => {
      if (incoming.roomId !== roomId) {
        return;
      }

      const senderUserId = incoming.userId;

      if (senderUserId) {
        const existingTimer = bubbleTimers.current.get(senderUserId);

        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        setActiveBubbles((current) => ({
          ...current,
          [senderUserId]: {
            messageId: incoming.id,
            content: truncateText(
              incoming.content,
              BUBBLE_MAX_LENGTH,
            ),
          },
        }));

        const timer = setTimeout(() => {
          setActiveBubbles((current) => {
            if (
              current[senderUserId]?.messageId !== incoming.id
            ) {
              return current;
            }

            const next = { ...current };
            delete next[senderUserId];

            return next;
          });

          bubbleTimers.current.delete(senderUserId);
        }, BUBBLE_LIFETIME_MS);

        bubbleTimers.current.set(senderUserId, timer);
      }

      if (
        incoming.userId === currentUserId ||
        chatOpen
      ) {
        return;
      }

      setUnreadCount((current) => current + 1);

      if (!messageMentionsUser(incoming, currentUser)) {
        return;
      }

      setMentionCount((current) => current + 1);

      setMentionNotification({
        id: incoming.id,
        senderName: incoming.displayName?.trim() || "Someone",
        senderAvatarId: incoming.avatarId,
        content: truncateText(
          incoming.content,
          MENTION_PREVIEW_MAX_LENGTH,
        ),
      });
    },
    [roomId, currentUserId, chatOpen, currentUser],
  );

  /*
   * Spatial-room ambient behavior must remain active even while
   * the chat drawer is closed.
   */
  useEffect(() => {
    socket.on("chat:message", handleIncomingMessage);

    return () => {
      socket.off("chat:message", handleIncomingMessage);
    };
  }, [handleIncomingMessage]);

  function handleSeatClick(seatId: string) {
    if (!currentUserId || occupiedSeats.has(seatId)) {
      return;
    }

    setAssignments((current) => ({
      ...current,
      [currentUserId]: seatId,
    }));
  }

  function closeParticipantMenu() {
    setOpenParticipantId(null);
  }

  function clearChatIndicators() {
    setUnreadCount(0);
    setMentionCount(0);
    setMentionNotification(null);
  }

  function openChat() {
    setMusicOpen(false);
    closeParticipantMenu();

    setChatOpen(true);
    clearChatIndicators();
  }

  function closeChat() {
    setChatOpen(false);
  }

  function toggleMusic() {
    const shouldOpen = !musicOpen;

    setMusicOpen(shouldOpen);
    setChatOpen(false);
    closeParticipantMenu();
    setMentionNotification(null);
  }

  function toggleParticipantMenu(userId: string) {
    setOpenParticipantId((current) =>
      current === userId ? null : userId,
    );

    setChatOpen(false);
    setMusicOpen(false);
    setMentionNotification(null);
  }

  function mentionParticipant(participant: SpatialParticipant) {
    if (!currentUserId) {
      return;
    }

    closeParticipantMenu();
    setMusicOpen(false);
    clearChatIndicators();

    setChatPrefill({
      text: `@${participant.displayName} `,
      requestId: Date.now(),
    });

    setChatOpen(true);
  }

  const handleChatPrefillConsumed = useCallback(() => {
    setChatPrefill(null);
  }, []);

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Spatial room
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            People in this space
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-sm text-neutral-500">
            {users.length}/{capacity}
          </p>

          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? "bg-green-400" : "bg-neutral-600"
              }`}
            />

            <span className="text-sm text-neutral-500">
              {connected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      <div className="relative min-h-[520px] overflow-hidden bg-neutral-950 sm:min-h-[620px]">
        {/* Room environment */}
        <div className="absolute inset-x-0 top-0 h-[36%] border-b border-neutral-800 bg-neutral-900/60" />

        <div className="absolute left-1/2 top-[10%] -translate-x-1/2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-950 px-8 py-3 text-center shadow-lg">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
              VIBE
            </p>

            <p className="mt-1 text-sm text-neutral-400">
              shared space
            </p>
          </div>
        </div>

        <div className="absolute inset-x-[7%] bottom-[8%] top-[19%] rounded-[3rem] border border-neutral-800/70 bg-neutral-900/30" />

        {/* Music */}
        <div className="absolute left-4 top-4 z-40">
          <button
            type="button"
            onClick={toggleMusic}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/95 text-lg text-neutral-200 shadow-lg backdrop-blur transition hover:bg-neutral-800"
            aria-label={
              musicOpen
                ? "Close shared music"
                : "Open shared music"
            }
            title="Shared music"
          >
            <span aria-hidden="true">🔊</span>
          </button>
        </div>

        {/* Chat */}
        <div className="absolute right-4 top-4 z-40">
          <button
            type="button"
            onClick={() => {
              if (chatOpen) {
                closeChat();
              } else {
                openChat();
              }
            }}
            className="relative flex h-11 min-w-11 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/95 px-3 text-sm text-neutral-200 shadow-lg backdrop-blur transition hover:bg-neutral-800"
            aria-label={
              chatOpen ? "Close room chat" : "Open room chat"
            }
          >
            <span aria-hidden="true" className="text-lg">
              💬
            </span>

            {unreadCount > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-neutral-900 bg-red-500"
                />

                <span className="sr-only">
                  {unreadCount} unread room{" "}
                  {unreadCount === 1 ? "message" : "messages"}
                </span>
              </>
            )}

            {mentionCount > 0 && (
              <span className="absolute -left-2 -top-2 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-950">
                @{mentionCount}
              </span>
            )}
          </button>
        </div>

        {/* Mention notification */}
        {mentionNotification && !chatOpen && (
          <button
            type="button"
            onClick={openChat}
            className="absolute right-4 top-20 z-50 w-[min(20rem,calc(100%-2rem))] rounded-2xl border border-neutral-700 bg-neutral-100 px-4 py-3 text-left text-neutral-950 shadow-xl transition hover:bg-white"
            aria-label={`${mentionNotification.senderName} mentioned you. Open room chat.`}
          >
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <VibeAvatar
                  avatarId={mentionNotification.senderAvatarId}
                  size="sm"
                />

                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 text-sm"
                >
                  ✨
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {mentionNotification.senderName} mentioned you
                </p>

                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-neutral-600">
                  {mentionNotification.content}
                </p>

                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                  Tap to jump into chat
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Empty seats */}
        {SPATIAL_SEATS.map((seat) => {
          if (occupiedSeats.has(seat.id)) {
            return null;
          }

          return (
            <button
              key={seat.id}
              type="button"
              disabled={!currentUserId}
              onClick={() => handleSeatClick(seat.id)}
              title={
                currentUserId
                  ? "Move here"
                  : "Join the room to choose a seat"
              }
              className={`absolute h-14 w-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed transition ${
                currentUserId
                  ? "border-neutral-700 bg-neutral-900/40 hover:border-neutral-500 hover:bg-neutral-800/60"
                  : "cursor-default border-neutral-800/50 bg-neutral-900/20"
              }`}
              style={{
                left: `${seat.x}%`,
                top: `${seat.y}%`,
              }}
            >
              <span className="text-xs text-neutral-700">
                Seat
              </span>
            </button>
          );
        })}

        {/* Participants */}
        {renderedSeats.map(({ participant, position }) => {
          const isCurrentUser =
            participant.userId === currentUserId;

          const bubble = activeBubbles[participant.userId];

          return (
            <div
              key={participant.userId}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-out"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
            >
              <div className="group relative flex w-24 flex-col items-center sm:w-28">
                {bubble && (
                  <button
                    type="button"
                    onClick={openChat}
                    className="absolute bottom-[calc(100%+0.65rem)] left-1/2 z-20 w-44 -translate-x-1/2 rounded-xl border border-neutral-700 bg-neutral-100 px-3 py-2 text-left text-xs leading-5 text-neutral-950 shadow-xl transition hover:bg-white"
                    title="Open room chat"
                  >
                    <span className="line-clamp-3 break-words">
                      {bubble.content}
                    </span>

                    <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-neutral-700 bg-neutral-100" />
                  </button>
                )}

                <div className="relative">
                  <div className="absolute left-1/2 top-[82%] h-5 w-16 -translate-x-1/2 rounded-full bg-black/30 blur-md" />

                  <div className="relative transition-transform duration-200 group-hover:-translate-y-1">
                    <VibeAvatar
                      avatarId={participant.avatarId}
                      size="lg"
                    />
                  </div>

                  <span className="absolute -right-1 bottom-1 h-3 w-3 rounded-full border-2 border-neutral-950 bg-green-400" />
                </div>

                <div className="relative mt-2 flex items-start gap-1">
                  <div
                    className={`min-w-0 max-w-full rounded-lg border px-3 py-1.5 text-center shadow-lg backdrop-blur ${
                      isCurrentUser
                        ? "border-neutral-500 bg-neutral-900"
                        : "border-neutral-800 bg-neutral-950/90"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">
                      {participant.displayName}
                    </p>

                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                      {isCurrentUser
                        ? "You"
                        : participant.identityType === "GUEST"
                          ? "Guest"
                          : "Registered"}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-participant-menu-trigger
                    onClick={() =>
                      toggleParticipantMenu(participant.userId)
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950/90 text-sm text-neutral-500 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-neutral-200"
                    aria-label={`More options for ${participant.displayName}`}
                    title={`More options for ${participant.displayName}`}
                  >
                    ⋯
                  </button>

                  {openParticipantId === participant.userId && (
                    <div
                      data-participant-menu
                      className="absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 text-left shadow-2xl"
                    >
                      <div className="border-b border-neutral-800 p-3">
                        <div className="flex items-center gap-3">
                          <VibeAvatar
                            avatarId={participant.avatarId}
                            size="sm"
                          />

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-neutral-100">
                              {participant.displayName}
                            </p>

                            <p className="mt-0.5 text-xs text-neutral-500">
                              {isCurrentUser
                                ? `You · ${
                                    participant.identityType ===
                                    "GUEST"
                                      ? "Guest"
                                      : "Registered"
                                  }`
                                : participant.identityType ===
                                    "GUEST"
                                  ? "Guest"
                                  : "Registered"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {isCurrentUser ? (
                        <div className="p-3">
                          <p className="text-xs leading-5 text-neutral-500">
                            This is you. Click an empty seat to move.
                          </p>
                        </div>
                      ) : (
                        <div className="p-2">
                          <button
                            type="button"
                            onClick={() =>
                              mentionParticipant(participant)
                            }
                            disabled={!currentUserId}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="font-semibold"
                              >
                                @
                              </span>

                              Mention
                            </span>

                            <span className="text-xs text-neutral-600">
                              Room
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled
                            className="mt-1 flex w-full cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-neutral-500 opacity-60"
                          >
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true">💬</span>
                              Message
                            </span>

                            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                              Soon
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <p className="font-medium text-neutral-300">
                This room is quiet.
              </p>

              <p className="mt-1 text-sm text-neutral-600">
                Join the room to take a seat.
              </p>
            </div>
          </div>
        )}

        {/* Chat drawer */}
        {chatOpen && (
          <>
            <button
              type="button"
              aria-label="Close room chat"
              onClick={closeChat}
              className="absolute inset-0 z-30 bg-black/20"
            />

            <aside className="absolute bottom-3 left-3 right-3 top-16 z-40 flex flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl sm:left-auto sm:right-4 sm:w-96">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <div>
                  <p className="font-medium">Room chat</p>

                  <p className="text-xs text-neutral-500">
                    {users.length}{" "}
                    {users.length === 1 ? "person" : "people"} here
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeChat}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
                  aria-label="Close chat"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1">
                <RoomChat
                  roomId={roomId}
                  canSend={Boolean(currentUserId)}
                  participants={users}
                  currentUserId={currentUserId}
                  compact
                  prefillText={chatPrefill?.text ?? null}
                  prefillRequestId={
                    chatPrefill?.requestId ?? 0
                  }
                  onPrefillConsumed={
                    handleChatPrefillConsumed
                  }
                />
              </div>
            </aside>
          </>
        )}

        {/* Music popover */}
        {musicOpen && (
          <>
            <button
              type="button"
              aria-label="Close shared music"
              onClick={() => setMusicOpen(false)}
              className="absolute inset-0 z-30 bg-black/20"
            />

            <aside className="absolute bottom-3 left-3 right-3 top-16 z-40 flex flex-col overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl sm:bottom-auto sm:right-auto sm:w-[22rem]">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-lg">
                    🔊
                  </span>

                  <div>
                    <p className="font-medium">Shared music</p>
                    <p className="text-xs text-neutral-500">
                      Room listening
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMusicOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
                  aria-label="Close shared music"
                >
                  ×
                </button>
              </div>

              <div className="p-4">
                <RoomMusic
                  roomId={roomId}
                  isOwner={isOwner}
                  canControl={Boolean(currentUserId)}
                  compact
                />
              </div>
            </aside>
          </>
        )}
      </div>

      <footer className="border-t border-neutral-800 px-6 py-4">
        <p className="text-xs text-neutral-600">
          {currentUserId
            ? "Choose a seat, chat with the room, and share the vibe."
            : "Join the room to participate."}
        </p>
      </footer>
    </section>
  );
}