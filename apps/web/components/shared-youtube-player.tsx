"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface MusicPlaybackState {
  status: "PLAYING" | "PAUSED";
  positionSeconds: number;
  updatedAt: string;
}

export interface SharedYouTubePlayerHandle {
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
}

interface SharedYouTubePlayerProps {
  videoId: string;
  playback: MusicPlaybackState;
  title: string;
  muted: boolean;
  onEnded?: (positionSeconds: number) => void;
}

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

interface YouTubePlayerStateEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubePlayerOptions {
  videoId: string;
  width: string;
  height: string;

  playerVars: {
    autoplay: number;
    controls: number;
    disablekb: number;
    playsinline: number;
    rel: number;
    origin: string;
  };

  events: {
    onReady: (event: YouTubePlayerEvent) => void;

    onStateChange: (event: YouTubePlayerStateEvent) => void;

    onError: () => void;

    onAutoplayBlocked: () => void;
  };
}

interface YouTubeAPI {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const DRIFT_CHECK_INTERVAL_MS = 5000;

const PLAYING_DRIFT_THRESHOLD_SECONDS = 1.75;

const PAUSED_DRIFT_THRESHOLD_SECONDS = 0.35;

/*
 * YouTube IFrame API state values:
 *
 * -1 = unstarted
 *  0 = ended
 *  1 = playing
 *  2 = paused
 *  3 = buffering
 *  5 = cued
 */
const YOUTUBE_PLAYER_STATE_ENDED = 0;

const YOUTUBE_PLAYER_STATE_PLAYING = 1;

let apiPromise: Promise<YouTubeAPI> | null = null;

function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();

      if (window.YT?.Player) {
        resolve(window.YT);

        return;
      }

      apiPromise = null;

      reject(new Error("YouTube player API is unavailable"));
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");

    script.src = "https://www.youtube.com/iframe_api";

    script.async = true;

    script.onerror = () => {
      apiPromise = null;

      reject(new Error("Unable to load the YouTube player API"));
    };

    document.head.appendChild(script);
  });

  return apiPromise;
}

function expectedPosition(playback: MusicPlaybackState): number {
  if (playback.status === "PAUSED") {
    return Math.max(0, playback.positionSeconds);
  }

  const timestamp = Date.parse(playback.updatedAt);

  const elapsedSeconds = Number.isFinite(timestamp)
    ? Math.max(0, (Date.now() - timestamp) / 1000)
    : 0;

  return Math.max(0, playback.positionSeconds + elapsedSeconds);
}

function getBoundedTarget(
  player: YouTubePlayer,
  playback: MusicPlaybackState,
): number {
  const target = expectedPosition(playback);

  const duration = player.getDuration();

  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return target;
  }

  return Math.min(target, duration);
}

const SharedYouTubePlayer = forwardRef<
  SharedYouTubePlayerHandle,
  SharedYouTubePlayerProps
>(function SharedYouTubePlayer(
  { videoId, playback, title, muted, onEnded },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const playerRef = useRef<YouTubePlayer | null>(null);

  /*
   * Async YouTube callbacks and timers must always
   * observe the newest authoritative room state.
   */
  const playbackRef = useRef(playback);

  const mutedRef = useRef(muted);

  const onEndedRef = useRef(onEnded);

  /*
   * YouTube may emit multiple transitions around
   * natural completion. Only report a completion
   * once per playback lifecycle.
   */
  const endedReportedRef = useRef(false);

  const [ready, setReady] = useState(false);

  const [playerError, setPlayerError] = useState<string | null>(null);

  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  /*
   * Refs are intentionally updated during render.
   * They do not trigger another render and ensure
   * callbacks do not capture stale props.
   */
  playbackRef.current = playback;

  mutedRef.current = muted;

  onEndedRef.current = onEnded;

  /*
   * Local drift correction only.
   *
   * This function never emits Socket.IO commands and
   * never writes to Redis.
   */
  const correctPosition = useCallback(
    (
      player: YouTubePlayer,

      force = false,
    ) => {
      const currentPlayback = playbackRef.current;

      const target = getBoundedTarget(player, currentPlayback);

      const current = player.getCurrentTime();

      const threshold =
        currentPlayback.status === "PLAYING"
          ? PLAYING_DRIFT_THRESHOLD_SECONDS
          : PAUSED_DRIFT_THRESHOLD_SECONDS;

      const shouldSeek =
        force ||
        typeof current !== "number" ||
        !Number.isFinite(current) ||
        Math.abs(current - target) > threshold;

      if (shouldSeek) {
        player.seekTo(target, true);
      }
    },
    [],
  );

  /*
   * Apply the latest server-authoritative playback
   * state to the local YouTube player.
   */
  const applyAuthoritativePlayback = useCallback(
    (
      player: YouTubePlayer,

      forcePosition = false,
    ) => {
      const currentPlayback = playbackRef.current;

      correctPosition(player, forcePosition);

      if (currentPlayback.status === "PLAYING") {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    },
    [correctPosition],
  );

  useImperativeHandle(
    ref,
    () => ({
      getCurrentTime() {
        const seconds = playerRef.current?.getCurrentTime();

        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          return Math.max(0, seconds);
        }

        return expectedPosition(playbackRef.current);
      },

      getDuration() {
        const seconds = playerRef.current?.getDuration();

        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          return Math.max(0, seconds);
        }

        return 0;
      },

      play() {
        playerRef.current?.playVideo();
      },
    }),
    [],
  );

  /*
   * A fresh PLAYING command starts a new possible
   * completion lifecycle.
   *
   * Ref mutation is sufficient here; no component
   * state update is needed.
   */
  useEffect(() => {
    if (playback.status === "PLAYING") {
      endedReportedRef.current = false;
    }
  }, [playback.status, playback.updatedAt]);

  /*
   * Create the YouTube IFrame player.
   *
   * RoomMusic keys this component by track identity,
   * so a different shared track receives a fresh
   * component/player lifecycle.
   */
  useEffect(() => {
    let disposed = false;

    let createdPlayer: YouTubePlayer | null = null;

    const container = containerRef.current;

    /*
     * Ref mutation does not cause a render and avoids
     * set-state-in-effect lint violations.
     */
    endedReportedRef.current = false;

    if (!container) {
      return;
    }

    loadYouTubeAPI()
      .then((api) => {
        if (disposed) {
          return;
        }

        createdPlayer = new api.Player(container, {
          videoId,

          width: "100%",

          height: "100%",

          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,

            origin: window.location.origin,
          },

          events: {
            onReady(event) {
              if (disposed) {
                return;
              }

              playerRef.current = event.target;

              /*
               * Personal mute is local only.
               */
              if (mutedRef.current) {
                event.target.mute();
              } else {
                event.target.unMute();
              }

              /*
               * Late joiners and remounted players
               * immediately jump to the current
               * authoritative room position.
               */
              applyAuthoritativePlayback(event.target, true);

              setReady(true);
            },

            onStateChange(event) {
              if (disposed) {
                return;
              }

              /*
               * Successful playback means autoplay
               * is no longer blocked locally.
               *
               * This callback comes from the
               * external YouTube API, so updating
               * React state here is appropriate.
               */
              if (event.data === YOUTUBE_PLAYER_STATE_PLAYING) {
                setAutoplayBlocked(false);

                return;
              }

              if (
                event.data !== YOUTUBE_PLAYER_STATE_ENDED ||
                endedReportedRef.current ||
                playbackRef.current.status !== "PLAYING"
              ) {
                return;
              }

              endedReportedRef.current = true;

              const duration = event.target.getDuration();

              const currentTime = event.target.getCurrentTime();

              /*
               * Duration is the ideal final
               * timestamp. Current time is the
               * fallback if YouTube does not expose
               * duration for some reason.
               */
              const endingPosition =
                typeof duration === "number" &&
                Number.isFinite(duration) &&
                duration > 0
                  ? duration
                  : typeof currentTime === "number" &&
                      Number.isFinite(currentTime)
                    ? Math.max(0, currentTime)
                    : 0;

              onEndedRef.current?.(endingPosition);
            },

            onError() {
              if (disposed) {
                return;
              }

              setPlayerError(
                "YouTube could not play this video. Try opening it on YouTube.",
              );
            },

            onAutoplayBlocked() {
              if (disposed) {
                return;
              }

              setAutoplayBlocked(true);
            },
          },
        });
      })
      .catch(() => {
        if (disposed) {
          return;
        }

        setPlayerError("Unable to load the YouTube player.");
      });

    return () => {
      disposed = true;

      playerRef.current = null;

      createdPlayer?.destroy();
    };
  }, [videoId, applyAuthoritativePlayback]);

  /*
   * Apply explicit authoritative updates:
   *
   * - play
   * - pause
   * - seek
   *
   * Small natural drift is ignored.
   */
  useEffect(() => {
    const player = playerRef.current;

    if (!player || !ready) {
      return;
    }

    applyAuthoritativePlayback(player);
  }, [
    playback.status,
    playback.positionSeconds,
    playback.updatedAt,
    ready,
    applyAuthoritativePlayback,
  ]);

  /*
   * Personal mute never changes shared playback.
   */
  useEffect(() => {
    const player = playerRef.current;

    if (!player || !ready) {
      return;
    }

    if (muted) {
      player.mute();
    } else {
      player.unMute();
    }
  }, [muted, ready]);

  /*
   * Every five seconds, compare the local player
   * against the server timestamp.
   *
   * Correction only occurs when drift exceeds the
   * configured tolerance.
   */
  useEffect(() => {
    if (!ready) {
      return;
    }

    const timer = window.setInterval(() => {
      const player = playerRef.current;

      if (!player) {
        return;
      }

      /*
       * Background tabs are often throttled.
       * Visibility recovery below handles those
       * rather than seeking while hidden.
       */
      if (document.visibilityState !== "visible") {
        return;
      }

      if (playbackRef.current.status !== "PLAYING") {
        return;
      }

      correctPosition(player);
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [ready, correctPosition]);

  /*
   * Browsers may suspend or heavily throttle a
   * background tab. Resynchronize immediately when
   * the participant returns.
   */
  useEffect(() => {
    if (!ready) {
      return;
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        return;
      }

      const player = playerRef.current;

      if (!player) {
        return;
      }

      applyAuthoritativePlayback(player);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ready, applyAuthoritativePlayback]);

  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-lg border border-neutral-800 bg-black">
        <div ref={containerRef} aria-label={title} className="h-full w-full" />
      </div>

      {!ready && !playerError && (
        <p className="mt-2 text-xs text-neutral-500">
          Loading YouTube player...
        </p>
      )}

      {playerError && (
        <p className="mt-2 text-xs text-red-400">{playerError}</p>
      )}

      {autoplayBlocked && playback.status === "PLAYING" && (
        <div className="mt-2 rounded-lg border border-amber-900/60 bg-amber-950/30 p-3">
          <p className="text-xs text-amber-200">
            Your browser blocked automatic playback. Click below to start
            listening.
          </p>

          <button
            type="button"
            onClick={() => {
              const player = playerRef.current;

              if (!player) {
                return;
              }

              /*
               * Bring this browser to the current
               * room timestamp before allowing the
               * user to start locally blocked audio.
               */
              correctPosition(player, true);

              player.playVideo();

              /*
               * This update happens in a user event,
               * not inside an effect.
               */
              setAutoplayBlocked(false);
            }}
            className="mt-2 rounded-md bg-amber-200 px-3 py-1.5 text-xs font-medium text-neutral-950"
          >
            Enable playback
          </button>
        </div>
      )}
    </div>
  );
});

export default SharedYouTubePlayer;
