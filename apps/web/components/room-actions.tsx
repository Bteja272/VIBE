"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { getVibeToken, joinRoom, leaveRoom } from "@/src/lib/api";

import {
  clearGuestActiveRoom,
  getGuestActiveRoom,
  getGuestSession,
  setGuestActiveRoom,
  type GuestSession,
} from "@/src/lib/guest-auth";

import { getPresenceId } from "@/src/lib/presence-session";

import { ensureSocketConnection, socket } from "@/src/lib/socket";

interface RoomActionsProps {
  roomId: string;
  isMember: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
}

interface EnterResponse {
  entered: boolean;
  roomId: string;
  error?: string;
}

export default function RoomActions({
  roomId,
  isMember,
  isOwner,
  isSignedIn,
}: RoomActionsProps) {
  const router = useRouter();

  const [member, setMember] = useState(isMember);

  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);

  const [guestJoined, setGuestJoined] = useState(false);

  const [guestLoaded, setGuestLoaded] = useState(isSignedIn);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      return;
    }

    const guest = getGuestSession();

    setGuestSession(guest);

    setGuestJoined(Boolean(guest && getGuestActiveRoom() === roomId));

    setGuestLoaded(true);
  }, [isSignedIn]);

  async function enterPresence(token: string) {
    await ensureSocketConnection(token);

    return new Promise<void>((resolve, reject) => {
      socket.timeout(5000).emit(
        "presence:enter",

        {
          roomId,

          presenceId: getPresenceId(),
        },

        (
          timeoutError: Error | null,

          response?: EnterResponse,
        ) => {
          if (timeoutError) {
            reject(new Error("Unable to join the room right now."));

            return;
          }

          if (!response?.entered) {
            reject(new Error(response?.error ?? "Unable to join room"));

            return;
          }

          resolve();
        },
      );
    });
  }

  async function handleRegisteredJoin() {
    setError(null);

    setLoading(true);

    try {
      const auth = await getVibeToken();

      await enterPresence(auth.token);

      try {
        await joinRoom(roomId, auth.token);
      } catch (err) {
        socket.emit("presence:leave");

        throw err;
      }

      setMember(true);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisteredLeave() {
    setError(null);

    setLoading(true);

    try {
      const auth = await getVibeToken();

      await leaveRoom(roomId, auth.token);

      socket.emit("presence:leave");

      setMember(false);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave room");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestJoin() {
    if (!guestSession) {
      setError("Create a guest identity from the homepage first.");

      return;
    }

    setError(null);

    setLoading(true);

    try {
      await enterPresence(guestSession.token);
      setGuestActiveRoom(roomId);
      setGuestJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  }

  function handleGuestLeave() {
    setError(null);

    socket.emit("presence:leave");

    clearGuestActiveRoom();

    setGuestJoined(false);
  }

  if (isOwner) {
    return null;
  }

  if (isSignedIn) {
    return (
      <div>
        {member ? (
          <button
            type="button"
            onClick={handleRegisteredLeave}
            disabled={loading}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50"
          >
            {loading ? "Leaving..." : "Leave room"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRegisteredJoin}
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

  if (!guestLoaded) {
    return <p className="text-sm text-neutral-500">Loading guest session...</p>;
  }

  if (!guestSession) {
    return (
      <div>
        <p className="text-sm text-neutral-400">
          Choose a guest name before joining.
        </p>

        <Link
          href="/"
          className="mt-3 inline-block rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
        >
          Continue as Guest
        </Link>
      </div>
    );
  }

  if (guestJoined) {
    return (
      <div>
        <button
          type="button"
          onClick={handleGuestLeave}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500"
        >
          Leave room
        </button>

        <p className="mt-2 text-xs text-neutral-500">
          Joined as {guestSession.user.displayName}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGuestJoin}
        disabled={loading}
        className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join room"}
      </button>

      <p className="mt-2 text-xs text-neutral-500">
        Joining as {guestSession.user.displayName}
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
