"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import SharedYouTubePlayer, {
  type MusicPlaybackState,
  type SharedYouTubePlayerHandle,
} from "@/components/shared-youtube-player";

import { socket } from "@/src/lib/socket";

type MusicPermission = "OWNER_ONLY" | "ANY_MEMBER";

type PlaybackAction = "PLAY" | "PAUSE" | "SEEK";

interface RoomMusicState {
  roomId: string;

  /*
   * Monotonically increasing version supplied by the backend.
   *
   * It prevents an older Socket.IO acknowledgement from
   * replacing newer room state.
   */
  revision?: number;

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

const MAX_POSITION_SECONDS = 86_400;

const PERSONAL_MUTE_KEY = "vibe_personal_music_muted";

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/*
 * room:watch and presence restoration may occur
 * elsewhere immediately after Socket.IO reconnects.
 *
 * Retrying music:get prevents that startup race
 * from leaving shared music stale.
 */
const RECONNECT_SYNC_DELAYS_MS = [0, 250, 750, 1500];

function expectedPosition(playback: MusicPlaybackState): number {
  if (playback.status === "PAUSED") {
    return Math.max(0, playback.positionSeconds);
  }

  const updatedAt = Date.parse(playback.updatedAt);

  const elapsedSeconds = Number.isFinite(updatedAt)
    ? Math.max(0, (Date.now() - updatedAt) / 1000)
    : 0;

  return Math.max(0, playback.positionSeconds + elapsedSeconds);
}

function formatTime(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));

  const hours = Math.floor(total / 3600);

  const minutes = Math.floor((total % 3600) / 60);

  const remainder = String(total % 60).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`;
  }

  return `${minutes}:${remainder}`;
}

function getTrackIdentity(state: RoomMusicState | null): string | null {
  const track = state?.track;

  if (!track) {
    return null;
  }

  return track.trackId ?? track.videoId ?? track.url;
}

/*
 * revision is the primary ordering mechanism.
 *
 * updatedAt remains as a compatibility fallback for
 * any older state produced before revisions existed.
 */
function shouldAcceptState(
  current: RoomMusicState | null,
  incoming: RoomMusicState,
): boolean {
  if (!current) {
    return true;
  }

  const currentRevision =
    typeof current.revision === "number" && Number.isFinite(current.revision)
      ? current.revision
      : null;

  const incomingRevision =
    typeof incoming.revision === "number" && Number.isFinite(incoming.revision)
      ? incoming.revision
      : null;

  if (currentRevision !== null && incomingRevision !== null) {
    return incomingRevision >= currentRevision;
  }

  /*
   * Never allow legacy unversioned state to
   * overwrite state from the revised backend.
   */
  if (currentRevision !== null && incomingRevision === null) {
    return false;
  }

  if (currentRevision === null && incomingRevision !== null) {
    return true;
  }

  const currentTime = Date.parse(current.updatedAt);

  const incomingTime = Date.parse(incoming.updatedAt);

  if (!Number.isFinite(currentTime) || !Number.isFinite(incomingTime)) {
    return true;
  }

  return incomingTime >= currentTime;
}

export default function RoomMusic({
  roomId,
  isOwner,
  canControl,
  compact = false,
}: RoomMusicProps) {
  const [state, setState] = useState<RoomMusicState | null>(null);

  /*
   * Keeps synchronous event callbacks aware of
   * the newest accepted music state without making
   * state itself an effect dependency.
   */
  const stateRef = useRef<RoomMusicState | null>(null);

  const [url, setUrl] = useState("");

  const [title, setTitle] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [playbackLoading, setPlaybackLoading] = useState(false);

  const [sharingOpen, setSharingOpen] = useState(false);

  const [personalMuted, setPersonalMuted] = useState(false);

  const [duration, setDuration] = useState(0);

  const [currentSeconds, setCurrentSeconds] = useState(0);

  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const playerRef = useRef<SharedYouTubePlayerHandle | null>(null);

  /*
   * A stale previous-room value may exist for one render
   * while routing. Never render it for another room.
   */
  const activeState = state?.roomId === roomId ? state : null;

  const canEditMusic =
    canControl && (isOwner || activeState?.permission === "ANY_MEMBER");

  const track = activeState?.track ?? null;

  const playback = activeState?.playback ?? null;

  const youtubeVideoId =
    track?.provider === "youtube" &&
    track.videoId &&
    YOUTUBE_VIDEO_ID_PATTERN.test(track.videoId)
      ? track.videoId
      : null;

  const hasSharedControls = Boolean(
    youtubeVideoId && track?.trackId && playback,
  );

  const seekMaximum = Math.min(MAX_POSITION_SECONDS, Math.max(0, duration));

  const shownSeconds = Math.min(
    seekMaximum || MAX_POSITION_SECONDS,

    seekPreview ?? currentSeconds,
  );

  /*
   * Central entry point for all authoritative state:
   *
   * - music:update broadcasts
   * - music:get responses
   * - command acknowledgements
   *
   * Visual track state is reset here rather than from
   * a React effect. Socket callbacks and user-action
   * callbacks are legitimate places to update state.
   */
  const acceptState = useCallback(
    (incoming: RoomMusicState) => {
      if (incoming.roomId !== roomId) {
        return;
      }

      const current =
        stateRef.current?.roomId === roomId ? stateRef.current : null;

      if (!shouldAcceptState(current, incoming)) {
        return;
      }

      const previousTrack = getTrackIdentity(current);

      const nextTrack = getTrackIdentity(incoming);

      if (previousTrack !== nextTrack) {
        setDuration(0);

        setCurrentSeconds(
          incoming.playback ? expectedPosition(incoming.playback) : 0,
        );

        setSeekPreview(null);
      }

      stateRef.current = incoming;

      setState(incoming);
    },
    [roomId],
  );

  /*
   * Load the browser-local mute preference.
   *
   * requestAnimationFrame moves the state update out
   * of the synchronous effect body while still loading
   * it immediately after mount.
   */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setPersonalMuted(
          window.sessionStorage.getItem(PERSONAL_MUTE_KEY) === "true",
        );
      } catch {
        /*
         * sessionStorage may be unavailable.
         * The default false state still works.
         */
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  /*
   * Authoritative room-music subscription.
   *
   * music:update handles live changes.
   *
   * music:get handles:
   * - initial mount
   * - reconnect
   * - room restoration
   * - returning from a background tab
   */
  useEffect(() => {
    let active = true;

    const retryTimers: number[] = [];

    function clearRetryTimers() {
      for (const timer of retryTimers) {
        window.clearTimeout(timer);
      }

      retryTimers.length = 0;
    }

    function handleMusicUpdate(incoming: RoomMusicState) {
      if (!active) {
        return;
      }

      acceptState(incoming);
    }

    function loadMusicState() {
      if (!active || !socket.connected) {
        return;
      }

      socket.timeout(SOCKET_TIMEOUT_MS).emit(
        "music:get",
        undefined,

        (
          timeoutError: Error | null,

          response?: MusicActionResponse,
        ) => {
          if (timeoutError || !active || !response?.ok || !response.state) {
            return;
          }

          acceptState(response.state);
        },
      );
    }

    function scheduleReconnectSync() {
      clearRetryTimers();

      for (const delay of RECONNECT_SYNC_DELAYS_MS) {
        const timer = window.setTimeout(loadMusicState, delay);

        retryTimers.push(timer);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && socket.connected) {
        loadMusicState();
      }
    }

    socket.on("music:update", handleMusicUpdate);

    socket.on("connect", scheduleReconnectSync);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (socket.connected) {
      scheduleReconnectSync();
    }

    return () => {
      active = false;

      clearRetryTimers();

      socket.off("music:update", handleMusicUpdate);

      socket.off("connect", scheduleReconnectSync);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acceptState]);

  /*
   * DISPLAY TIMER ONLY.
   *
   * This does not seek playback and does not send
   * Socket.IO commands. SharedYouTubePlayer owns
   * actual synchronization.
   */
  useEffect(() => {
    if (!playback || !youtubeVideoId) {
      return;
    }

    function refreshDisplay() {
      const reportedDuration = playerRef.current?.getDuration() ?? 0;

      if (reportedDuration > 0) {
        setDuration(reportedDuration);
      }

      const localTime = playerRef.current?.getCurrentTime();

      const displayedTime =
        typeof localTime === "number" && Number.isFinite(localTime)
          ? localTime
          : expectedPosition(playback!);

      setCurrentSeconds(Math.max(0, displayedTime));
    }

    /*
     * Avoid performing synchronous component state
     * updates directly inside the effect body.
     */
    const firstFrame = window.requestAnimationFrame(refreshDisplay);

    const timer = window.setInterval(refreshDisplay, 1000);

    return () => {
      window.cancelAnimationFrame(firstFrame);

      window.clearInterval(timer);
    };
  }, [playback, youtubeVideoId]);

  function shareTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!url.trim() || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:set",

      {
        url: url.trim(),

        title: title.trim() || undefined,
      },

      (
        timeoutError: Error | null,

        response?: MusicActionResponse,
      ) => {
        setLoading(false);

        if (timeoutError || !response?.ok) {
          setError(
            timeoutError
              ? "The server did not respond."
              : (response?.error ?? "Unable to share music"),
          );

          return;
        }

        setUrl("");
        setTitle("");
        setSharingOpen(false);

        if (response.state) {
          acceptState(response.state);
        }
      },
    );
  }

  function clearTrack() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:clear",
      undefined,

      (
        timeoutError: Error | null,

        response?: MusicActionResponse,
      ) => {
        setLoading(false);

        if (timeoutError || !response?.ok) {
          setError(
            timeoutError
              ? "The server did not respond."
              : (response?.error ?? "Unable to clear music"),
          );

          return;
        }

        if (response.state) {
          acceptState(response.state);
        }
      },
    );
  }

  function changePermission(permission: MusicPermission) {
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:permission",

      {
        permission,
      },

      (
        timeoutError: Error | null,

        response?: MusicActionResponse,
      ) => {
        if (timeoutError || !response?.ok) {
          setError(
            timeoutError
              ? "The server did not respond."
              : (response?.error ?? "Unable to change permission"),
          );

          return;
        }

        if (response.state) {
          acceptState(response.state);
        }
      },
    );
  }

  function togglePersonalMute() {
    setPersonalMuted((current) => {
      const next = !current;

      try {
        window.sessionStorage.setItem(PERSONAL_MUTE_KEY, String(next));
      } catch {
        /*
         * Keep the preference in component state
         * if storage is unavailable.
         */
      }

      return next;
    });
  }

  function sendPlaybackCommand(
    action: PlaybackAction,

    positionSeconds: number,
  ) {
    if (
      !canEditMusic ||
      !track?.trackId ||
      !playback ||
      playbackLoading ||
      loading ||
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

      (
        timeoutError: Error | null,

        response?: MusicActionResponse,
      ) => {
        setPlaybackLoading(false);

        if (timeoutError || !response?.ok) {
          setError(
            timeoutError
              ? "The server did not respond to the playback command."
              : (response?.error ?? "Unable to update playback"),
          );

          return;
        }

        /*
         * This acknowledgement could arrive after
         * a newer music:update. Revision checking
         * prevents rolling state backwards.
         */
        if (response.state) {
          acceptState(response.state);
        }
      },
    );
  }

  function toggleSharedPlayback() {
    if (!playback || !canEditMusic || playbackLoading) {
      return;
    }

    const action: PlaybackAction =
      playback.status === "PLAYING" ? "PAUSE" : "PLAY";

    const localPosition = playerRef.current?.getCurrentTime();

    let position =
      typeof localPosition === "number" && Number.isFinite(localPosition)
        ? localPosition
        : expectedPosition(playback);

    /*
     * Replaying after natural completion should
     * restart from the beginning.
     */
    if (action === "PLAY" && duration > 0 && position >= duration - 0.75) {
      position = 0;
    }

    /*
     * Direct invocation from the click helps the
     * controlling browser pass autoplay restrictions.
     *
     * Redis remains authoritative.
     */
    if (action === "PLAY") {
      playerRef.current?.play();
    }

    sendPlaybackCommand(action, position);
  }

  function commitSeek(value: number) {
    setSeekPreview(null);

    if (!canEditMusic || !playback || !duration) {
      return;
    }

    const boundedValue = Math.min(duration, Math.max(0, value));

    setCurrentSeconds(boundedValue);

    sendPlaybackCommand("SEEK", boundedValue);
  }

  function handleTrackEnded(positionSeconds: number) {
    /*
     * Every local YouTube player can detect completion,
     * but only an authorized controller may mutate the
     * shared room state.
     */
    if (!canEditMusic || !playback || playback.status !== "PLAYING") {
      return;
    }

    const boundedPosition = Math.max(
      0,
      Math.min(MAX_POSITION_SECONDS, positionSeconds),
    );

    setCurrentSeconds(boundedPosition);

    /*
     * Natural completion maps to PAUSED at the final
     * timestamp rather than introducing a third
     * playback state.
     */
    sendPlaybackCommand("PAUSE", boundedPosition);
  }

  return (
    <section
      className={
        compact
          ? "min-w-0 text-neutral-100"
          : "rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-neutral-100"
      }
    >
      {!compact && <h2 className="mb-3 text-lg font-semibold">Shared music</h2>}

      <div className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        {track ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800"
              >
                ♪
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {track.title || "Shared track"}
                </p>

                <p className="truncate text-xs text-neutral-500">
                  Shared by {track.sharedBy}
                </p>
              </div>

              {playback && (
                <span className="shrink-0 text-[11px] text-neutral-400">
                  {playback.status === "PLAYING" ? "Playing" : "Paused"}
                </span>
              )}
            </div>

            {youtubeVideoId && playback && (
              <div className="mt-3">
                <SharedYouTubePlayer
                  key={track.trackId ?? youtubeVideoId}
                  ref={playerRef}
                  videoId={youtubeVideoId}
                  playback={playback}
                  title={track.title ?? "Shared YouTube video"}
                  muted={personalMuted}
                  onEnded={handleTrackEnded}
                />

                {hasSharedControls && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSharedPlayback}
                        disabled={!canEditMusic || loading || playbackLoading}
                        className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-2 py-2 text-xs font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {playback.status === "PLAYING"
                          ? "Pause for everyone"
                          : "Play for everyone"}
                      </button>

                      <button
                        type="button"
                        onClick={togglePersonalMute}
                        aria-label={
                          personalMuted
                            ? "Unmute shared music for me"
                            : "Mute shared music for me"
                        }
                        title={personalMuted ? "Unmute for me" : "Mute for me"}
                        aria-pressed={personalMuted}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 text-lg transition hover:bg-neutral-800"
                      >
                        <span aria-hidden="true">
                          {personalMuted ? "🔇" : "🔊"}
                        </span>
                      </button>

                      <a
                        href={track.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open track on YouTube"
                        title="Open on YouTube"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 text-base transition hover:bg-neutral-800"
                      >
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                        {formatTime(shownSeconds)}
                      </span>

                      <input
                        type="range"
                        min={0}
                        max={seekMaximum || 1}
                        step={1}
                        value={Math.min(
                          seekMaximum || 1,

                          Math.max(
                            0,

                            seekPreview ?? currentSeconds,
                          ),
                        )}
                        onChange={(event) =>
                          setSeekPreview(Number(event.target.value))
                        }
                        onPointerUp={(event) =>
                          commitSeek(Number(event.currentTarget.value))
                        }
                        onKeyUp={(event) => {
                          if (
                            [
                              "ArrowLeft",
                              "ArrowRight",
                              "Home",
                              "End",
                              "PageUp",
                              "PageDown",
                            ].includes(event.key)
                          ) {
                            commitSeek(Number(event.currentTarget.value));
                          }
                        }}
                        disabled={
                          !canEditMusic ||
                          loading ||
                          playbackLoading ||
                          !duration
                        }
                        aria-label="Seek shared music"
                        title={
                          canEditMusic
                            ? "Seek for everyone"
                            : "Only an authorized participant can seek"
                        }
                        className="min-w-0 flex-1 accent-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                      />

                      <span className="w-9 shrink-0 text-[11px] tabular-nums text-neutral-400">
                        {duration > 0 ? formatTime(duration) : "--:--"}
                      </span>
                    </div>

                    {!canEditMusic && (
                      <p className="text-xs text-neutral-500">
                        Only an authorized participant can change room playback.
                        Your mute is personal.
                      </p>
                    )}
                  </div>
                )}

                {!track.trackId && (
                  <p className="mt-2 text-xs text-amber-300">
                    Share this track again to enable shared controls.
                  </p>
                )}
              </div>
            )}

            {!youtubeVideoId && (
              <a
                href={track.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block truncate rounded-lg border border-neutral-700 px-3 py-2 text-center text-sm hover:bg-neutral-800"
              >
                Open shared link ↗
              </a>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-neutral-400">
            Nothing shared yet.
          </p>
        )}
      </div>

      {(canEditMusic || isOwner) && (
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          <button
            type="button"
            aria-expanded={sharingOpen}
            aria-controls={`music-sharing-${roomId}`}
            onClick={() => setSharingOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium hover:bg-neutral-800"
          >
            <span>Share or change music</span>

            <span aria-hidden="true" className="text-neutral-400">
              {sharingOpen ? "−" : "+"}
            </span>
          </button>

          {sharingOpen && (
            <div
              id={`music-sharing-${roomId}`}
              className="space-y-3 border-t border-neutral-800 p-3"
            >
              {isOwner && (
                <label className="block text-xs text-neutral-400">
                  Who can share music?
                  <select
                    value={activeState?.permission ?? "OWNER_ONLY"}
                    onChange={(event) =>
                      changePermission(event.target.value as MusicPermission)
                    }
                    className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="OWNER_ONLY">Owner only</option>

                    <option value="ANY_MEMBER">Any participant</option>
                  </select>
                </label>
              )}

              {canEditMusic && (
                <form onSubmit={shareTrack} className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Track title (optional)"
                    aria-label="Track title (optional)"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />

                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="YouTube or music URL"
                    aria-label="Music URL"
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={loading || !url.trim()}
                      className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
                    >
                      {loading ? "Sharing..." : "Share track"}
                    </button>

                    {track && (
                      <button
                        type="button"
                        onClick={clearTrack}
                        disabled={loading}
                        className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                      >
                        Clear track
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {!canControl && (
        <p className="mt-3 text-xs text-neutral-500">
          Join the room to share music.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
