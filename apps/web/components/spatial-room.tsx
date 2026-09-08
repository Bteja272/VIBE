"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import RoomChat from "@/components/room-chat";
import VibeAvatar from "@/components/vibe-avatar";

import {
  buildSpatialSeats,
  reconcileSeatAssignments,
  SPATIAL_SEATS,
  type SpatialParticipant,
} from "@/src/lib/spatial-layout";

import type { ChatMessage } from "@/src/types/chat";

interface SpatialRoomProps {
  roomId: string;

  users: SpatialParticipant[];

  connected: boolean;

  currentUserId?: string | null;

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

const BUBBLE_LIFETIME_MS = 5000;

const MENTION_NOTIFICATION_LIFETIME_MS = 4000;

function getStorageKey(roomId: string) {
  return `vibe_spatial_seats_${roomId}`;
}

function truncateBubble(content: string) {
  const trimmed = content.trim();

  if (trimmed.length <= 70) {
    return trimmed;
  }

  return `${trimmed.slice(0, 67)}...`;
}

function truncateMentionNotification(content: string) {
  const trimmed = content.trim();

  if (trimmed.length <= 90) {
    return trimmed;
  }

  return `${trimmed.slice(0, 87)}...`;
}

function messageMentionsUser(
  message: ChatMessage,
  currentUser: SpatialParticipant | undefined,
) {
  if (!currentUser) {
    return false;
  }

  const mention = `@${currentUser.displayName}`;

  return message.content
    .toLocaleLowerCase()
    .includes(mention.toLocaleLowerCase());
}

export default function SpatialRoom({
  roomId,
  users,
  connected,
  currentUserId = null,
  capacity = 12,
}: SpatialRoomProps) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const [loaded, setLoaded] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);

  const [mentionCount, setMentionCount] = useState(0);

  const [mentionNotification, setMentionNotification] =
    useState<MentionNotification | null>(null);

  const [activeBubbles, setActiveBubbles] = useState<
    Record<string, ActiveBubble>
  >({});

  const bubbleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const currentUser = useMemo(
    () => users.find((user) => user.userId === currentUserId),
    [users, currentUserId],
  );

  /*
   * Restore browser-local seat assignments.
   */
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(getStorageKey(roomId));

      if (stored) {
        setAssignments(JSON.parse(stored) as Record<string, string>);
      }
    } catch {
      /*
       * Invalid storage should not prevent
       * the spatial room from rendering.
       */
    } finally {
      setLoaded(true);
    }
  }, [roomId]);

  /*
   * Keep seats stable as live presence changes.
   */
  useEffect(() => {
    if (!loaded) {
      return;
    }

    setAssignments((current) => reconcileSeatAssignments(users, current));
  }, [users, loaded]);

  /*
   * Persist browser-local seat state.
   */
  useEffect(() => {
    if (!loaded) {
      return;
    }

    window.sessionStorage.setItem(
      getStorageKey(roomId),
      JSON.stringify(assignments),
    );
  }, [roomId, assignments, loaded]);

  /*
   * Clean up speech-bubble timers.
   */
  useEffect(() => {
    const timers = bubbleTimers.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  /*
   * Mention notifications are intentionally
   * temporary and disappear after four seconds.
   */
  useEffect(() => {
    if (!mentionNotification) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMentionNotification(null);
    }, MENTION_NOTIFICATION_LIFETIME_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mentionNotification]);

  const occupiedSeats = useMemo(
    () => new Set(Object.values(assignments)),
    [assignments],
  );

  const renderedSeats = useMemo(
    () => buildSpatialSeats(users, assignments),
    [users, assignments],
  );

  function handleSeatClick(seatId: string) {
    if (!currentUserId) {
      return;
    }

    /*
     * A participant cannot take an occupied seat.
     */
    if (occupiedSeats.has(seatId)) {
      return;
    }

    setAssignments((current) => ({
      ...current,

      [currentUserId]: seatId,
    }));
  }

  const handleIncomingMessage = useCallback(
    (incoming: ChatMessage) => {
      const senderUserId = incoming.userId;

      /*
       * Show the sender's newest room message
       * temporarily above their spatial avatar.
       *
       * Legacy Redis messages without userId
       * remain visible in chat but cannot be
       * attached to an avatar reliably.
       */
      if (senderUserId) {
        const existingTimer = bubbleTimers.current.get(senderUserId);

        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        setActiveBubbles((current) => ({
          ...current,

          [senderUserId]: {
            messageId: incoming.id,

            content: truncateBubble(incoming.content),
          },
        }));

        const timer = setTimeout(() => {
          setActiveBubbles((current) => {
            if (current[senderUserId]?.messageId !== incoming.id) {
              return current;
            }

            const next = {
              ...current,
            };

            delete next[senderUserId];

            return next;
          });

          bubbleTimers.current.delete(senderUserId);
        }, BUBBLE_LIFETIME_MS);

        bubbleTimers.current.set(senderUserId, timer);
      }

      /*
       * Your own message should never count as
       * unread or produce a mention notification.
       */
      if (incoming.userId === currentUserId) {
        return;
      }

      /*
       * If chat is open, the message is already
       * visible, so it is not considered unread.
       */
      if (chatOpen) {
        return;
      }

      setUnreadCount((current) => current + 1);

      const mentionedCurrentUser = messageMentionsUser(incoming, currentUser);

      if (!mentionedCurrentUser) {
        return;
      }

      setMentionCount((current) => current + 1);

      setMentionNotification({
        id: incoming.id,

        senderName: incoming.displayName?.trim() || "Someone",

        senderAvatarId: incoming.avatarId,

        content: truncateMentionNotification(incoming.content),
      });
    },
    [chatOpen, currentUser, currentUserId],
  );

  function openChat() {
    setChatOpen(true);

    setUnreadCount(0);

    setMentionCount(0);

    setMentionNotification(null);
  }

  function closeChat() {
    setChatOpen(false);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Spatial room
          </p>

          <h2 className="mt-1 text-xl font-semibold">People in this space</h2>
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
      </div>

      <div className="relative min-h-[520px] overflow-hidden bg-neutral-950 sm:min-h-[620px]">
        {/* Back wall */}
        <div className="absolute inset-x-0 top-0 h-[36%] border-b border-neutral-800 bg-neutral-900/60" />

        {/* Room focal point */}
        <div className="absolute left-1/2 top-[10%] -translate-x-1/2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-950 px-8 py-3 text-center shadow-lg">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
              VIBE
            </p>

            <p className="mt-1 text-sm text-neutral-400">shared space</p>
          </div>
        </div>

        {/* Floor */}
        <div className="absolute inset-x-[7%] bottom-[8%] top-[19%] rounded-[3rem] border border-neutral-800/70 bg-neutral-900/30" />

        {/* Chat control */}
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
            aria-label={chatOpen ? "Close room chat" : "Open room chat"}
          >
            <span aria-hidden="true" className="text-lg">
              💬
            </span>

            {unreadCount > 0 && (
              <>
                <span
                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-neutral-900 bg-red-500"
                  aria-hidden="true"
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

        {/* Personal mention notification */}
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
                  className="absolute -right-1 -top-1 text-sm"
                  aria-hidden="true"
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
          const occupied = occupiedSeats.has(seat.id);

          if (occupied) {
            return null;
          }

          return (
            <button
              key={seat.id}
              type="button"
              disabled={!currentUserId}
              onClick={() => handleSeatClick(seat.id)}
              title={
                currentUserId ? "Move here" : "Join the room to choose a seat"
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
              <span className="text-xs text-neutral-700">Seat</span>
            </button>
          );
        })}

        {/* Participants */}
        {renderedSeats.map(({ participant, position, seatId }) => {
          const isCurrentUser = participant.userId === currentUserId;

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
                {/* Temporary room-message bubble */}
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
                    <VibeAvatar avatarId={participant.avatarId} size="lg" />
                  </div>

                  <span className="absolute -right-1 bottom-1 h-3 w-3 rounded-full border-2 border-neutral-950 bg-green-400" />
                </div>

                <div
                  className={`relative mt-2 max-w-full rounded-lg border px-3 py-1.5 text-center shadow-lg backdrop-blur ${
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

                <p className="mt-1 text-[10px] text-neutral-700">{seatId}</p>
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

        {/* Integrated chat drawer */}
        {chatOpen && (
          <>
            <button
              type="button"
              aria-label="Close room chat"
              onClick={closeChat}
              className="absolute inset-0 z-30 bg-black/20"
            />

            <aside className="absolute bottom-4 right-4 top-16 z-40 flex w-[min(24rem,calc(100%-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <div>
                  <p className="font-medium">Room chat</p>

                  <p className="text-xs text-neutral-500">
                    {users.length} {users.length === 1 ? "person" : "people"}{" "}
                    here
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
                  onIncomingMessage={handleIncomingMessage}
                />
              </div>
            </aside>
          </>
        )}
      </div>

      <div className="border-t border-neutral-800 px-6 py-4">
        <p className="text-xs text-neutral-600">
          {currentUserId
            ? "Click an empty seat to move. Use chat to talk with everyone in the room."
            : "Join the room to choose a seat and chat."}
        </p>
      </div>
    </section>
  );
}
