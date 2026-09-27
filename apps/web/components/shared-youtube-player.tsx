"use client";

import {
  forwardRef,
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

/*
 * While playing we tolerate a small amount of natural browser /
 * network drift. Constant tiny seeks make video playback feel worse
 * than being about a second out of sync.
 */
const PLAYING_DRIFT_THRESHOLD_SECONDS = 1.75;

/*
 * Paused state should be more precise because there is no natural
 * playback movement once the authoritative pause has arrived.
 */
const PAUSED_DRIFT_THRESHOLD_SECONDS = 0.35;

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

function getBoundedTarget(player: YouTubePlayer, playback: MusicPlaybackState) {
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
>(function SharedYouTubePlayer({ videoId, playback, title, muted }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const playerRef = useRef<YouTubePlayer | null>(null);

  const playbackRef = useRef(playback);

  const mutedRef = useRef(muted);

  const [ready, setReady] = useState(false);

  const [playerError, setPlayerError] = useState<string | null>(null);

  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  /*
   * Async YouTube callbacks and interval callbacks read from refs,
   * so they always use the newest authoritative state.
   */
  playbackRef.current = playback;
  mutedRef.current = muted;

  function correctPosition(player: YouTubePlayer, force = false) {
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
  }

  function applyAuthoritativePlayback(
    player: YouTubePlayer,
    forcePosition = false,
  ) {
    const currentPlayback = playbackRef.current;

    correctPosition(player, forcePosition);

    if (currentPlayback.status === "PLAYING") {
      player.playVideo();
    } else {
      player.pauseVideo();

      setAutoplayBlocked(false);
    }
  }

  useImperativeHandle(ref, () => ({
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
  }));

  /*
   * Create the YouTube player.
   *
   * A newly mounted player must force-sync to the current room
   * position because it may be joining several minutes into a track.
   */
  useEffect(() => {
    let disposed = false;

    let createdPlayer: YouTubePlayer | null = null;

    const container = containerRef.current;

    setReady(false);
    setPlayerError(null);
    setAutoplayBlocked(false);

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

              if (mutedRef.current) {
                event.target.mute();
              } else {
                event.target.unMute();
              }

              /*
               * Late join / remount synchronization.
               */
              applyAuthoritativePlayback(event.target, true);

              setReady(true);
            },

            onError() {
              if (!disposed) {
                setPlayerError(
                  "YouTube could not play this video. Try opening it on YouTube.",
                );
              }
            },

            onAutoplayBlocked() {
              if (!disposed) {
                setAutoplayBlocked(true);
              }
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          setPlayerError("Unable to load the YouTube player.");
        }
      });

    return () => {
      disposed = true;

      playerRef.current = null;

      createdPlayer?.destroy();
    };
  }, [videoId]);

  /*
   * Apply explicit authoritative room changes:
   *
   * play
   * pause
   * seek
   *
   * Small natural drift is ignored here.
   */
  useEffect(() => {
    const player = playerRef.current;

    if (!player || !ready) {
      return;
    }

    applyAuthoritativePlayback(player);
  }, [playback.status, playback.positionSeconds, playback.updatedAt, ready]);

  /*
   * Personal mute is deliberately independent of room playback.
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
   * Lightweight drift correction.
   *
   * We do not write anything to Redis and we do not emit any
   * Socket.IO command. Each browser simply compares itself with
   * the authoritative timestamp it already received.
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
       * Background tabs frequently throttle timers. We wait until
       * visibility returns instead of trying to correct while hidden.
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
  }, [ready]);

  /*
   * Browsers may freeze or heavily throttle a background tab.
   * Immediately resync when the participant returns to VIBE.
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
  }, [ready]);

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
               * Bring the browser to the current room position
               * before enabling locally blocked playback.
               */
              correctPosition(player, true);

              player.playVideo();

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
