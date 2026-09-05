"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { socket } from "@/src/lib/socket";
import { joinRoom, leaveRoom } from "@/src/lib/api";
import { getPresenceId } from "@/src/lib/presence-session";

interface RoomActionsProps {
  roomId: string;
  isMember: boolean;
  isOwner: boolean;
  isFull: boolean;
}

const DEV_USER_EMAIL = "dev2@vibe.local";

export default function RoomActions({
  roomId,
  isMember,
  isOwner,
  isFull,
}: RoomActionsProps) {
  const router = useRouter();

  const [member, setMember] = useState(isMember);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError(null);
    setLoading(true);

    try {
      await joinRoom(roomId, DEV_USER_EMAIL);

      socket.emit("presence:enter", {
        roomId,
        presenceId:getPresenceId(),
        userEmail: DEV_USER_EMAIL,
      });

      setMember(true);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    setError(null);
    setLoading(true);

    try {
      await leaveRoom(roomId, DEV_USER_EMAIL);

      socket.emit(
        "presence:leave",
        undefined,
        (response: { left: boolean; roomId?: string }) => {
          console.log("Left live presence:", response);
        },
      );

      setMember(false);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave room");
    } finally {
      setLoading(false);
    }
  }

  if (isOwner) {
    return null;
  }
  if (!member && isFull) {
    return (
      <div>
        <span className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400">
          Room full
        </span>
      </div>
    );
  }

  return (
    <div>
      {member ? (
        <button
          type="button"
          onClick={handleLeave}
          disabled={loading}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50"
        >
          {loading ? "Leaving..." : "Leave room"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleJoin}
          disabled={loading}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join room"}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
