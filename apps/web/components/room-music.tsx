"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { socket } from "@/src/lib/socket";

type MusicPermission =
  | "OWNER_ONLY"
  | "ANY_MEMBER";

interface RoomMusicState {
  roomId: string;

  permission:
    MusicPermission;

  track: {
    url: string;
    title?: string;
    provider?: string;
    sharedBy: string;
  } | null;

  updatedAt: string;
}

interface RoomMusicProps {
  roomId: string;
  isOwner: boolean;
  canControl: boolean;
}

export default function RoomMusic({
  roomId,
  isOwner,
  canControl,
}: RoomMusicProps) {
  const [state, setState] =
    useState<RoomMusicState | null>(
      null,
    );

  const [url, setUrl] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    function handleMusicUpdate(
      incoming: RoomMusicState,
    ) {
      if (
        incoming.roomId !==
        roomId
      ) {
        return;
      }

      setState(incoming);
    }

    function loadState() {
      socket.emit(
        "music:get",
        undefined,
        (response: {
          ok: boolean;
          state?: RoomMusicState;
          error?: string;
        }) => {
          if (
            response?.ok &&
            response.state
          ) {
            setState(
              response.state,
            );
          }
        },
      );
    }

    socket.on(
      "music:update",
      handleMusicUpdate,
    );

    if (socket.connected) {
      loadState();
    }

    socket.on(
      "connect",
      loadState,
    );

    return () => {
      socket.off(
        "music:update",
        handleMusicUpdate,
      );

      socket.off(
        "connect",
        loadState,
      );
    };
  }, [roomId]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!url.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    socket
      .timeout(5000)
      .emit(
        "music:set",

        {
          url: url.trim(),

          title:
            title.trim() ||
            undefined,
        },

        (
          timeoutError: Error | null,

          response?: {
            ok: boolean;
            state?: RoomMusicState;
            error?: string;
          },
        ) => {
          setLoading(false);

          if (timeoutError) {
            setError(
              "The server did not respond.",
            );

            return;
          }

          if (!response?.ok) {
            setError(
              response?.error ??
                "Unable to update music",
            );

            return;
          }

          setUrl("");
          setTitle("");
        },
      );
  }

  function clearMusic() {
    setLoading(true);
    setError(null);

    socket
      .timeout(5000)
      .emit(
        "music:clear",
        undefined,

        (
          timeoutError: Error | null,

          response?: {
            ok: boolean;
            error?: string;
          },
        ) => {
          setLoading(false);

          if (timeoutError) {
            setError(
              "The server did not respond.",
            );

            return;
          }

          if (!response?.ok) {
            setError(
              response?.error ??
                "Unable to clear music",
            );
          }
        },
      );
  }

  function changePermission(
    permission:
      MusicPermission,
  ) {
    socket.emit(
      "music:permission",

      {
        permission,
      },

      (response: {
        ok: boolean;
        error?: string;
      }) => {
        if (!response?.ok) {
          setError(
            response?.error ??
              "Unable to change permission",
          );
        }
      },
    );
  }

  const allowedToControl =
    canControl;

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Music
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Shared room listening
        </p>
      </div>

      <div className="mt-5 rounded-xl bg-neutral-950 p-4">
        {state?.track ? (
          <>
            <p className="text-sm font-medium">
              {state.track.title ??
                "Shared track"}
            </p>

            <a
              href={state.track.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-sm text-neutral-400 underline"
            >
              {state.track.url}
            </a>

            <p className="mt-2 text-xs text-neutral-600">
              Shared by{" "}
              {
                state.track.sharedBy
              }
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            Nothing playing yet.
          </p>
        )}
      </div>

      {isOwner && (
        <div className="mt-5">
          <label className="text-sm font-medium">
            Who can control music?
          </label>

          <select
            value={
              state?.permission ??
              "OWNER_ONLY"
            }
            onChange={(event) =>
              changePermission(
                event.target
                  .value as MusicPermission,
              )
            }
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm"
          >
            <option value="OWNER_ONLY">
              Owner only
            </option>

            <option value="ANY_MEMBER">
              Any member
            </option>
          </select>
        </div>
      )}

      {allowedToControl && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-3"
        >
          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value,
              )
            }
            placeholder="Track title (optional)"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm"
          />

          <input
            type="url"
            value={url}
            onChange={(event) =>
              setUrl(
                event.target.value,
              )
            }
            placeholder="Spotify / YouTube / music URL"
            required
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm"
          />

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={
                loading ||
                !url.trim()
              }
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {loading
                ? "Sharing..."
                : "Share music"}
            </button>

            {state?.track && (
              <button
                type="button"
                onClick={
                  clearMusic
                }
                disabled={loading}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      )}

      {!allowedToControl &&
        canControl && (
          <p className="mt-5 text-sm text-neutral-500">
            Only the room owner
            can control music.
          </p>
        )}

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}