"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getVibeToken,
  joinRoom,
  leaveRoom,
} from "@/src/lib/api";

import {
  createGuestSession,
  getGuestSession,
} from "@/src/lib/guest-auth";

import {
  getPresenceId,
} from "@/src/lib/presence-session";

import {
  ensureSocketConnection,
  socket,
} from "@/src/lib/socket";

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
  const router =
    useRouter();

  const [
    member,
    setMember,
  ] =
    useState(
      isMember,
    );

  const [
    guestName,
    setGuestName,
  ] =
    useState("");

  const [
    guestJoined,
    setGuestJoined,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  useEffect(() => {
    if (
      isSignedIn
    ) {
      return;
    }

    const guest =
      getGuestSession();

    if (guest) {
      setGuestName(
        guest.user
          .displayName,
      );
    }
  }, [
    isSignedIn,
  ]);

  async function enterPresence(
    token: string,
  ) {
    await ensureSocketConnection(
      token,
    );

    return new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        socket
          .timeout(
            5000,
          )
          .emit(
            "presence:enter",

            {
              roomId,

              presenceId:
                getPresenceId(),
            },

            (
              timeoutError:
                Error | null,

              response?:
                EnterResponse,
            ) => {
              if (
                timeoutError
              ) {
                reject(
                  new Error(
                    "Unable to join the room right now.",
                  ),
                );

                return;
              }

              if (
                !response?.entered
              ) {
                reject(
                  new Error(
                    response?.error ??
                      "Unable to join room",
                  ),
                );

                return;
              }

              resolve();
            },
          );
      },
    );
  }

  async function handleRegisteredJoin() {
    setError(
      null,
    );

    setLoading(
      true,
    );

    try {
      const auth =
        await getVibeToken();

      await enterPresence(
        auth.token,
      );

      try {
        await joinRoom(
          roomId,
          auth.token,
        );
      } catch (
        error
      ) {
        socket.emit(
          "presence:leave",
        );

        throw error;
      }

      setMember(
        true,
      );

      router.refresh();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "Failed to join room",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  async function handleRegisteredLeave() {
    setError(
      null,
    );

    setLoading(
      true,
    );

    try {
      const auth =
        await getVibeToken();

      await leaveRoom(
        roomId,
        auth.token,
      );

      socket.emit(
        "presence:leave",
      );

      setMember(
        false,
      );

      router.refresh();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "Failed to leave room",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  async function handleGuestJoin() {
    const normalizedName =
      guestName.trim();

    if (
      normalizedName.length <
      2
    ) {
      setError(
        "Guest name must be at least 2 characters",
      );

      return;
    }

    setError(
      null,
    );

    setLoading(
      true,
    );

    try {
      const existing =
        getGuestSession();

      const guest =
        existing &&
        existing.user
          .displayName ===
          normalizedName
          ? existing
          : await createGuestSession(
              normalizedName,
            );

      await enterPresence(
        guest.token,
      );

      setGuestJoined(
        true,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "Failed to join as guest",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  function handleGuestLeave() {
    setError(
      null,
    );

    socket.emit(
      "presence:leave",
    );

    setGuestJoined(
      false,
    );
  }

  if (
    isOwner
  ) {
    return null;
  }

  if (
    isSignedIn
  ) {
    return (
      <div>
        {member ? (
          <button
            type="button"
            onClick={
              handleRegisteredLeave
            }
            disabled={
              loading
            }
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50"
          >
            {loading
              ? "Leaving..."
              : "Leave room"}
          </button>
        ) : (
          <button
            type="button"
            onClick={
              handleRegisteredJoin
            }
            disabled={
              loading
            }
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
          >
            {loading
              ? "Joining..."
              : "Join room"}
          </button>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (
    guestJoined
  ) {
    return (
      <div>
        <button
          type="button"
          onClick={
            handleGuestLeave
          }
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500"
        >
          Leave room
        </button>

        <p className="mt-2 text-xs text-neutral-500">
          Joined as{" "}
          {guestName}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-3">
      <div>
        <label
          htmlFor="guest-name"
          className="text-sm text-neutral-400"
        >
          Join without an account
        </label>

        <input
          id="guest-name"
          value={
            guestName
          }
          onChange={(
            event,
          ) =>
            setGuestName(
              event.target
                .value,
            )
          }
          minLength={
            2
          }
          maxLength={
            24
          }
          placeholder="Your name"
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <button
        type="button"
        onClick={
          handleGuestJoin
        }
        disabled={
          loading
        }
        className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        {loading
          ? "Joining..."
          : "Join as guest"}
      </button>

      <p className="text-xs text-neutral-600">
        Google sign-in is optional.
      </p>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}