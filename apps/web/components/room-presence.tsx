"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getVibeToken,
} from "@/src/lib/api";

import {
  getPresenceId,
} from "@/src/lib/presence-session";

import {
  ensureSocketConnection,
  socket,
} from "@/src/lib/socket";

interface RoomPresenceProps {
  roomId: string;

  /*
   * true for a persistent registered
   * owner/member.
   *
   * Guest entry is triggered by RoomActions.
   */
  shouldBePresent: boolean;
}

interface PresenceUser {
  socketId: string;
  presenceId: string;

  userId: string;

  displayName: string;

  identityType:
    | "GUEST"
    | "REGISTERED";

  email?: string;
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

        (
          response: {
            entered:
              boolean;

            error?:
              string;
          },
        ) => {
          if (
            !response?.entered
          ) {
            setError(
              response?.error ??
                "Unable to enter room",
            );
          }
        },
      );
    }

    async function start() {
      try {
        if (
          shouldBePresent
        ) {
          const auth =
            await getVibeToken();

          await ensureSocketConnection(
            auth.token,
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
          shouldBePresent
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

      if (
        shouldBePresent
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
      error: Error,
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

      /*
       * Harmless for anonymous viewers.
       * Important for guests because their
       * presence was entered by RoomActions.
       */
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
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Live presence
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            {
              users.length
            }{" "}
            {users.length ===
            1
              ? "person"
              : "people"}{" "}
            here
          </p>
        </div>

        <span
          className={
            connected
              ? "text-sm text-green-400"
              : "text-sm text-neutral-500"
          }
        >
          {connected
            ? "Connected"
            : "Disconnected"}
        </span>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {users.length >
        0 && (
        <div className="mt-5 space-y-2">
          {users.map(
            (
              user,
            ) => (
              <div
                key={
                  user.presenceId
                }
                className="flex items-center gap-3 rounded-xl bg-neutral-950 px-4 py-3"
              >
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {
                      user.displayName
                    }
                  </p>

                  <p className="text-xs text-neutral-600">
                    {user.identityType ===
                    "GUEST"
                      ? "Guest"
                      : user.email ??
                        "Registered"}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}