"use client";

import { useEffect, useState } from "react";

import { socket } from "@/src/lib/socket";
import { getPresenceId } from "@/src/lib/presence-session";

interface RoomPresenceProps {
  roomId: string;
  shouldBePresent: boolean;
  currentUserEmail: string;
}

interface PresenceUser {
  socketId: string;
  userEmail: string;
  presenceId: string;
}

interface PresenceUpdate {
  roomId: string;
  users: PresenceUser[];
  count: number;
}

export default function RoomPresence({
  roomId,
  shouldBePresent,
  currentUserEmail,
}: RoomPresenceProps) {
  const [connected, setConnected] =
    useState(false);

  const [users, setUsers] = useState<
    PresenceUser[]
  >([]);

  const [error, setError] = useState<
    string | null
  >(null);

  useEffect(() => {
    function watchRoom() {
      socket.emit(
        "room:watch",
        {
          roomId,
        },
        (response: {
          watching: boolean;
          roomId: string;
        }) => {
          console.log(
            "Watching socket room:",
            response,
          );
        },
      );

      if (shouldBePresent) {
        socket.emit(
          "presence:enter",
          {
            roomId,
            userEmail: currentUserEmail,
            presenceId: getPresenceId(),
          },
        );
      }
    }

    function handleConnect() {
      setConnected(true);
      setError(null);

      watchRoom();
    }

    function handleDisconnect() {
      setConnected(false);
      setUsers([]);
    }

    function handleConnectError(
      error: Error,
    ) {
      console.error(
        "Socket connection error:",
        error,
      );

      setError(error.message);
    }

    function handlePresenceUpdate(
      update: PresenceUpdate,
    ) {
      if (update.roomId !== roomId) {
        return;
      }

      setUsers(update.users);
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

    if (socket.connected) {
      setConnected(true);
      watchRoom();
    } else {
      socket.connect();
    }

    return () => {
      /*
       * If this browser was actively present,
       * leaving the page should remove it.
       */
      if (shouldBePresent) {
        socket.emit("presence:leave");
      }

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
    currentUserEmail,
  ]);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Live presence
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            {users.length}{" "}
            {users.length === 1
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

      {users.length > 0 && (
        <div className="mt-5 space-y-2">
          {users.map((user) => (
            <div
              key={user.presenceId}
              className="flex items-center gap-3 rounded-xl bg-neutral-950 px-4 py-3"
            >
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.userEmail}
                </p>

                <p className="text-xs text-neutral-600">
                  Online
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}