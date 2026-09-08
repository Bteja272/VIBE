"use client";

import { useEffect, useState } from "react";

import SpatialRoom from "@/components/spatial-room";

import { getVibeToken } from "@/src/lib/api";
import { getGuestActiveRoom, getGuestSession } from "@/src/lib/guest-auth";
import { getPresenceId } from "@/src/lib/presence-session";
import {
  ensureSocketConnection,
  socket,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
} from "@/src/lib/socket";

interface RoomPresenceProps {
  roomId: string;
  shouldBePresent: boolean;
  isOwner: boolean;
}

interface PresenceUser {
  socketId: string;
  presenceId: string;
  userId: string;
  displayName: string;
  identityType: "GUEST" | "REGISTERED";
  avatarId?: string;
}

interface PresenceUpdate {
  roomId: string;
  users: PresenceUser[];
  count: number;
}

interface PresenceEnterResponse {
  entered: boolean;
  error?: string;
}

export default function RoomPresence({
  roomId,
  shouldBePresent,
  isOwner,
}: RoomPresenceProps) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let shouldEnterRoom = false;
    let syncedSocketId: string | undefined;

    function watchRoom() {
      socket.emit("room:watch", { roomId });
    }

    function enterRoom() {
      socket.emit(
        "presence:enter",
        {
          roomId,
          presenceId: getPresenceId(),
        },
        (response: PresenceEnterResponse) => {
          if (!response?.entered) {
            setError(response?.error ?? "Unable to enter room");
            return;
          }

          startPresenceHeartbeat();
        },
      );
    }

    function syncRoom() {
      /*
       * ensureSocketConnection() and the socket "connect" event can
       * both reach this function. Sync only once per socket instance.
       */
      if (socket.id && syncedSocketId === socket.id) {
        return;
      }

      syncedSocketId = socket.id;

      setConnected(true);
      setError(null);

      watchRoom();

      if (shouldEnterRoom) {
        enterRoom();
      }
    }

    async function start() {
      try {
        const guest = getGuestSession();

        const activeGuest =
          guest && getGuestActiveRoom() === roomId ? guest : null;

        if (shouldBePresent) {
          const auth = await getVibeToken();

          if (cancelled) {
            return;
          }

          setCurrentUserId(auth.user.id);
          shouldEnterRoom = true;

          await ensureSocketConnection(auth.token);
        } else if (activeGuest) {
          setCurrentUserId(activeGuest.user.id);
          shouldEnterRoom = true;

          await ensureSocketConnection(activeGuest.token);
        } else {
          setCurrentUserId(null);
          shouldEnterRoom = false;

          await ensureSocketConnection();
        }

        if (cancelled) {
          return;
        }

        syncRoom();
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Realtime connection failed",
        );
      }
    }

    function handleConnect() {
      syncRoom();
    }

    function handleDisconnect() {
      syncedSocketId = undefined;

      setConnected(false);
      setUsers([]);
    }

    function handleConnectError(socketError: Error) {
      setError(socketError.message);
    }

    function handlePresenceUpdate(update: PresenceUpdate) {
      if (update.roomId === roomId) {
        setUsers(update.users);
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("presence:update", handlePresenceUpdate);

    void start();

    return () => {
      cancelled = true;

      stopPresenceHeartbeat();

      socket.emit("presence:leave");

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("presence:update", handlePresenceUpdate);

      socket.disconnect();
    };
  }, [roomId, shouldBePresent]);

  return (
    <div className="space-y-4">
      <SpatialRoom
        roomId={roomId}
        users={users}
        connected={connected}
        currentUserId={currentUserId}
        isOwner={isOwner}
        capacity={12}
      />

      {error && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
