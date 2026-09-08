"use client";

import {
  useEffect,
  useState,
} from "react";

import SpatialRoom from "@/components/spatial-room";
import VibeAvatar from "@/components/vibe-avatar";

import {
  getVibeToken,
} from "@/src/lib/api";

import {
  getGuestActiveRoom,
  getGuestSession,
} from "@/src/lib/guest-auth";

import {
  getPresenceId,
} from "@/src/lib/presence-session";

import {
  ensureSocketConnection,
  socket,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
} from "@/src/lib/socket";

interface RoomPresenceProps {
  roomId: string;

  shouldBePresent:
    boolean;
}

interface PresenceUser {
  socketId: string;
  presenceId: string;

  userId: string;

  displayName: string;

  identityType:
    | "GUEST"
    | "REGISTERED";

  avatarId?: string;
}

interface PresenceUpdate {
  roomId: string;

  users:
    PresenceUser[];

  count: number;
}

export default function RoomPresence({
  roomId,
  shouldBePresent,
}: RoomPresenceProps) {
  const [
    connected,
    setConnected,
  ] =
    useState(false);

  const [
    users,
    setUsers,
  ] =
    useState<
      PresenceUser[]
    >([]);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    let cancelled =
      false;

    function watchRoom() {
      socket.emit(
        "room:watch",
        {
          roomId,
        },
      );
    }

    function enterRoom() {
      socket.emit(
        "presence:enter",

        {
          roomId,

          presenceId:
            getPresenceId(),
        },

        (response: {
          entered: boolean;
          error?: string;
        }) => {
          if (
            !response?.entered
          ) {
            setError(
              response?.error ??
                "Unable to enter room",
            );

            return;
          }

          startPresenceHeartbeat();
        },
      );
    }

    async function start() {
      try {
        const guest =
          getGuestSession();

        const guestShouldBePresent =
          Boolean(
            guest &&
              getGuestActiveRoom() ===
                roomId,
          );

        if (
          shouldBePresent
        ) {
          const auth =
            await getVibeToken();

          await ensureSocketConnection(
            auth.token,
          );
        } else if (
          guestShouldBePresent &&
          guest
        ) {
          await ensureSocketConnection(
            guest.token,
          );
        } else {
          await ensureSocketConnection();
        }

        if (
          cancelled
        ) {
          return;
        }

        setConnected(
          true,
        );

        setError(
          null,
        );

        watchRoom();

        if (
          shouldBePresent ||
          guestShouldBePresent
        ) {
          enterRoom();
        }
      } catch (
        err
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          err instanceof
            Error
            ? err.message
            : "Realtime connection failed",
        );
      }
    }

    function handleConnect() {
      setConnected(
        true,
      );

      watchRoom();

      const guest =
        getGuestSession();

      const guestShouldBePresent =
        Boolean(
          guest &&
            getGuestActiveRoom() ===
              roomId,
        );

      if (
        shouldBePresent ||
        guestShouldBePresent
      ) {
        enterRoom();
      }
    }

    function handleDisconnect() {
      setConnected(
        false,
      );

      setUsers(
        [],
      );
    }

    function handleConnectError(
      error:
        Error,
    ) {
      setError(
        error.message,
      );
    }

    function handlePresenceUpdate(
      update:
        PresenceUpdate,
    ) {
      if (
        update.roomId !==
        roomId
      ) {
        return;
      }

      setUsers(
        update.users,
      );
    }

    socket.on(
      "connect",
      handleConnect,
    );

    socket.on(
      "disconnect",
      handleDisconnect,
    );

    socket.on(
      "connect_error",
      handleConnectError,
    );

    socket.on(
      "presence:update",
      handlePresenceUpdate,
    );

    void start();

    return () => {
      cancelled =
        true;

      stopPresenceHeartbeat();

      socket.emit(
        "presence:leave",
      );

      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "disconnect",
        handleDisconnect,
      );

      socket.off(
        "connect_error",
        handleConnectError,
      );

      socket.off(
        "presence:update",
        handlePresenceUpdate,
      );

      socket.disconnect();
    };
  }, [
    roomId,
    shouldBePresent,
  ]);

  return (
    <div className="space-y-6">
      <SpatialRoom
        users={
          users
        }
        connected={
          connected
        }
        capacity={
          12
        }
      />

      {error && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {/*
       * Keep the traditional list for now.
       *
       * It is useful while we verify the
       * spatial room and will eventually
       * become a compact participants panel.
       */}
      <details className="rounded-2xl border border-neutral-800 bg-neutral-900">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-neutral-300">
          Participants ({users.length})
        </summary>

        <div className="border-t border-neutral-800 p-5">
          {users.length ===
          0 ? (
            <p className="text-sm text-neutral-500">
              Nobody is currently in this room.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map(
                (
                  user,
                ) => (
                  <div
                    key={
                      user.userId
                    }
                    className="flex items-center gap-3 rounded-xl bg-neutral-950 px-4 py-3"
                  >
                    <VibeAvatar
                      avatarId={
                        user.avatarId
                      }
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {
                          user.displayName
                        }
                      </p>

                      <p className="text-xs text-neutral-600">
                        {user.identityType ===
                        "GUEST"
                          ? "Guest"
                          : "Registered"}
                      </p>
                    </div>

                    <div
                      className="h-2.5 w-2.5 rounded-full bg-green-400"
                      title="Online"
                    />
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}