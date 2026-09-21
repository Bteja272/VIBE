"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import SharedYouTubePlayer, {
  type MusicPlaybackState,
  type SharedYouTubePlayerHandle,
} from "@/components/shared-youtube-player";

import { socket } from "@/src/lib/socket";

type MusicPermission = "OWNER_ONLY" | "ANY_MEMBER";

type PlaybackAction = "PLAY" | "PAUSE" | "SEEK";

interface RoomMusicState {
  roomId: string;
  permission: MusicPermission;

  track: {
    trackId?: string;
    url: string;
    title?: string;
    provider?: string;
    videoId?: string;
    sharedBy: string;
  } | null;

  playback?: MusicPlaybackState | null;
  updatedAt: string;
}

interface RoomMusicProps {
  roomId: string;
  isOwner: boolean;
  canControl: boolean;
  compact?: boolean;
}

interface MusicActionResponse {
  ok: boolean;
  state?: RoomMusicState;
  error?: string;
}

const SOCKET_TIMEOUT_MS = 5000;

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

const MAX_POSITION_SECONDS = 86_400;

const PERSONAL_MUTE_KEY = "vibe_personal_music_muted";

function getExpectedPosition(playback: MusicPlaybackState): number {
  if (playback.status === "PAUSED") {
    return playback.positionSeconds;
  }

  const updatedAtMs = Date.parse(playback.updatedAt);

  if (!Number.isFinite(updatedAtMs)) {
    return playback.positionSeconds;
  }

  return (
    playback.positionSeconds + Math.max(0, (Date.now() - updatedAtMs) / 1000)
  );
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

  const [seekSeconds, setSeekSeconds] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);

  const playerRef = useRef<SharedYouTubePlayerHandle | null>(null);

  const [personalMuted, setPersonalMuted] = useState(false);

  const canEditMusic =
    canControl && (isOwner || state?.permission === "ANY_MEMBER");

  const track = state?.track ?? null;

  const playback = state?.playback ?? null;

  const youtubeVideoId =
    track?.provider === "youtube" &&
    track.videoId &&
    YOUTUBE_VIDEO_ID_PATTERN.test(track.videoId)
      ? track.videoId
      : null;

  const canUseSharedPlayback = Boolean(
    youtubeVideoId && track?.trackId && playback,
  );

  useEffect(() => {
    try {
      setPersonalMuted(
        window.sessionStorage.getItem(PERSONAL_MUTE_KEY) === "true",
      );
    } catch {
      // The control still works if session storage is unavailable.
    }
  }, []);

  useEffect(() => {
    setState(null);
    setError(null);

    function handleMusicUpdate(incoming: RoomMusicState) {
      if (incoming.roomId === roomId) {
        setState(incoming);
      }
    }

    function loadMusicState() {
      socket.emit("music:get", undefined, (response: MusicActionResponse) => {
        if (response?.ok && response.state?.roomId === roomId) {
          setState(response.state);
        }
      });
    }

    socket.on("music:update", handleMusicUpdate);
    socket.on("connect", loadMusicState);

    if (socket.connected) {
      loadMusicState();
    }

    return () => {
      socket.off("music:update", handleMusicUpdate);
      socket.off("connect", loadMusicState);
    };
  }, [roomId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trackUrl = url.trim();

    if (!trackUrl) {
      return;
    }

    setLoading(true);
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:set",
      {
        url: trackUrl,
        title: title.trim() || undefined,
      },
      (timeoutError: Error | null, response?: MusicActionResponse) => {
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

        if (response.state) {
          setState(response.state);
        }
      },
    );
  }

  function clearMusic() {
    setLoading(true);
    setError(null);

    socket
      .timeout(SOCKET_TIMEOUT_MS)
      .emit(
        "music:clear",
        undefined,
        (timeoutError: Error | null, response?: MusicActionResponse) => {
          setLoading(false);

          if (timeoutError) {
            setError("The server did not respond.");
            return;
          }

          if (!response?.ok) {
            setError(response?.error ?? "Unable to clear music");
            return;
          }

          if (response.state) {
            setState(response.state);
          }
        },
      );
  }

  function changePermission(permission: MusicPermission) {
    setError(null);

    socket.emit(
      "music:permission",
      { permission },
      (response: MusicActionResponse) => {
        if (!response?.ok) {
          setError(response?.error ?? "Unable to change permission");
        }
      },
    );
  }

  function togglePersonalMute() {
    const nextMuted = !personalMuted;

    setPersonalMuted(nextMuted);

    try {
      window.sessionStorage.setItem(PERSONAL_MUTE_KEY, String(nextMuted));
    } catch {
      // Keep the in-memory preference if storage is unavailable.
    }
  }

  function sendPlaybackCommand(
    action: PlaybackAction,
    positionSeconds: number,
  ) {
    if (
      !canEditMusic ||
      !track?.trackId ||
      !playback ||
      !Number.isFinite(positionSeconds)
    ) {
      return;
    }

    const boundedPosition = Math.max(
      0,
      Math.min(MAX_POSITION_SECONDS, positionSeconds),
    );

    setPlaybackLoading(true);
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:playback",
      {
        trackId: track.trackId,
        action,
        positionSeconds: boundedPosition,
      },
      (timeoutError: Error | null, response?: MusicActionResponse) => {
        setPlaybackLoading(false);

        if (timeoutError) {
          setError("The server did not respond to the playback command.");
          return;
        }

        if (!response?.ok) {
          setError(response?.error ?? "Unable to update playback");
          return;
        }

        if (response.state) {
          setState(response.state);
        }
      },
    );
  }

  function getPlaybackPosition(): number {
    const currentTime = playerRef.current?.getCurrentTime();

    if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
      return currentTime;
    }

    return playback ? getExpectedPosition(playback) : 0;
  }

  function handleSeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (seekSeconds.trim() === "") {
      return;
    }

    const seconds = Number(seekSeconds);

    if (
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds > MAX_POSITION_SECONDS
    ) {
      setError("Enter a valid position in seconds.");
      return;
    }

    sendPlaybackCommand("SEEK", seconds);
    setSeekSeconds("");
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
        <header>
          <h2 className="text-lg font-semibold">Music</h2>

          <p className="mt-1 text-sm text-neutral-500">Shared room listening</p>
        </header>
      )}

      <div
        className={
          compact
            ? "rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            : "mt-5 rounded-xl bg-neutral-950 p-4"
        }
      >
        {track ? (
          <>
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-lg"
              >
                ♪
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {track.title ?? "Shared track"}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Shared by {track.sharedBy}
                </p>
              </div>
            </div>

            {youtubeVideoId && playback && (
              <div className="mt-4">
                <SharedYouTubePlayer
                  key={track.trackId ?? youtubeVideoId}
                  ref={playerRef}
                  videoId={youtubeVideoId}
                  playback={playback}
                  title={track.title ?? "Shared YouTube video"}
                  muted={personalMuted}
                />

                {canUseSharedPlayback && (
                  <div className="mt-3 rounded-lg border border-neutral-800 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (playback.status === "PAUSED") {
                            /*
                             * Attempt local playback immediately
                             * from this user interaction.
                             *
                             * The authoritative command still
                             * goes through the server.
                             */
                            playerRef.current?.play();
                          }

                          sendPlaybackCommand(
                            playback.status === "PLAYING" ? "PAUSE" : "PLAY",
                            getPlaybackPosition(),
                          );
                        }}
                        disabled={!canEditMusic || playbackLoading || loading}
                        className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
                      >
                        {playback.status === "PLAYING"
                          ? "Pause for everyone"
                          : "Play for everyone"}
                      </button>

                      <button
                        type="button"
                        onClick={togglePersonalMute}
                        aria-pressed={personalMuted}
                        className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
                      >
                        {personalMuted ? "Unmute for me" : "Mute for me"}
                      </button>

                      <span className="text-xs text-neutral-500">
                        {playback.status === "PLAYING"
                          ? "Playing in room"
                          : "Paused in room"}
                      </span>
                    </div>

                    {canEditMusic && (
                      <form
                        onSubmit={handleSeek}
                        className="mt-3 flex flex-wrap items-end gap-2"
                      >
                        <label className="min-w-0 flex-1 text-xs text-neutral-400">
                          Seek to second
                          <input
                            type="number"
                            min="0"
                            max={MAX_POSITION_SECONDS}
                            step="1"
                            value={seekSeconds}
                            onChange={(event) =>
                              setSeekSeconds(event.target.value)
                            }
                            placeholder="e.g. 60"
                            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={
                            playbackLoading || loading || !seekSeconds.trim()
                          }
                          className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 disabled:opacity-50"
                        >
                          Seek for everyone
                        </button>
                      </form>
                    )}

                    {!canEditMusic && (
                      <p className="mt-3 text-xs text-neutral-500">
                        You can listen, but only an authorized participant can
                        change shared playback.
                      </p>
                    )}
                  </div>
                )}

                {!track.trackId && (
                  <p className="mt-2 text-xs text-amber-300">
                    This track was shared before synchronized playback was
                    enabled. Share it again to activate room controls.
                  </p>
                )}
              </div>
            )}

            <a
              href={track.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block rounded-lg border border-neutral-700 px-3 py-2 text-center text-sm text-neutral-300 transition hover:bg-neutral-800"
            >
              {youtubeVideoId ? "Open on YouTube ↗" : "Open track ↗"}
            </a>
          </>
        ) : (
          <div className="py-2 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-lg"
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

      {canEditMusic && (
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

            {track && (
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

      {!canEditMusic && canControl && (
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
