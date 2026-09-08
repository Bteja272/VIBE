"use client";

import { FormEvent, useEffect, useState } from "react";

import { socket } from "@/src/lib/socket";

type MusicPermission = "OWNER_ONLY" | "ANY_MEMBER";

interface RoomMusicState {
  roomId: string;

  permission: MusicPermission;

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

  compact?: boolean;
}

export default function RoomMusic({
  roomId,
  isOwner,
  canControl,
  compact = false,
}: RoomMusicProps) {
  const [state, setState] = useState<RoomMusicState | null>(null);

  const [url, setUrl] = useState("");

  const [title, setTitle] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleMusicUpdate(incoming: RoomMusicState) {
      if (incoming.roomId !== roomId) {
        return;
      }

      setState(incoming);
    }

    function loadState() {
      socket.emit(
        "music:get",
        undefined,
        (response: { ok: boolean; state?: RoomMusicState; error?: string }) => {
          if (response?.ok && response.state) {
            setState(response.state);
          }
        },
      );
    }

    socket.on("music:update", handleMusicUpdate);

    if (socket.connected) {
      loadState();
    }

    socket.on("connect", loadState);

    return () => {
      socket.off("music:update", handleMusicUpdate);

      socket.off("connect", loadState);
    };
  }, [roomId]);

  /*
   * The backend remains authoritative
   * about whether a participant can
   * actually change the music state.
   *
   * This frontend check is just UX.
   */
  const allowedToControl = Boolean(
    canControl && (isOwner || state?.permission === "ANY_MEMBER"),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!url.trim()) {
      return;
    }

    setLoading(true);

    setError(null);

    socket.timeout(5000).emit(
      "music:set",

      {
        url: url.trim(),

        title: title.trim() || undefined,
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
          setError("The server did not respond.");

          return;
        }

        if (!response?.ok) {
          setError(response?.error ?? "Unable to update music");

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

    socket.timeout(5000).emit(
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
          setError("The server did not respond.");

          return;
        }

        if (!response?.ok) {
          setError(response?.error ?? "Unable to clear music");
        }
      },
    );
  }

  function changePermission(permission: MusicPermission) {
    setError(null);

    socket.emit(
      "music:permission",

      {
        permission,
      },

      (response: { ok: boolean; error?: string }) => {
        if (!response?.ok) {
          setError(response?.error ?? "Unable to change permission");
        }
      },
    );
  }

  return (
    <section
      className={
        compact
          ? "bg-neutral-950"
          : "rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
      }
    >
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold">Music</h2>

          <p className="mt-1 text-sm text-neutral-500">Shared room listening</p>
        </div>
      )}

      <div
        className={
          compact
            ? "rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            : "mt-5 rounded-xl bg-neutral-950 p-4"
        }
      >
        {state?.track ? (
          <>
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-lg"
                aria-hidden="true"
              >
                ♪
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {state.track.title ?? "Shared track"}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Shared by {state.track.sharedBy}
                </p>
              </div>
            </div>

            <a
              href={state.track.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block rounded-lg border border-neutral-700 px-3 py-2 text-center text-sm text-neutral-300 transition hover:bg-neutral-800"
            >
              Open track ↗
            </a>
          </>
        ) : (
          <div className="py-2 text-center">
            <div
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-lg"
              aria-hidden="true"
            >
              ♪
            </div>

            <p className="mt-3 text-sm text-neutral-500">Nothing shared yet.</p>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="mt-4">
          <label
            htmlFor={`music-permission-${roomId}`}
            className="text-xs font-medium text-neutral-400"
          >
            Who can share music?
          </label>

          <select
            id={`music-permission-${roomId}`}
            value={state?.permission ?? "OWNER_ONLY"}
            onChange={(event) =>
              changePermission(event.target.value as MusicPermission)
            }
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm"
          >
            <option value="OWNER_ONLY">Owner only</option>

            <option value="ANY_MEMBER">Any participant</option>
          </select>
        </div>
      )}

      {allowedToControl && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Track title (optional)"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500"
          />

          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Spotify / YouTube / music URL"
            required
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {loading ? "Sharing..." : "Share"}
            </button>

            {state?.track && (
              <button
                type="button"
                onClick={clearMusic}
                disabled={loading}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      )}

      {!allowedToControl && canControl && (
        <p className="mt-4 text-xs text-neutral-500">
          The room owner currently controls music.
        </p>
      )}

      {!canControl && (
        <p className="mt-4 text-xs text-neutral-500">
          Join the room to share music.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
