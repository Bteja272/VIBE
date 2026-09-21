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
  getPlayerState(): number;
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

    function handleReady() {
      previousCallback?.();

      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        apiPromise = null;
        reject(new Error("YouTube player API is unavailable"));
      }
    }

    window.onYouTubeIframeAPIReady = handleReady;

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
    return playback.positionSeconds;
  }

  const updatedAtMs = Date.parse(playback.updatedAt);

  if (!Number.isFinite(updatedAtMs)) {
    return playback.positionSeconds;
  }

  const elapsedSeconds = Math.max(0, (Date.now() - updatedAtMs) / 1000);

  return playback.positionSeconds + elapsedSeconds;
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

  playbackRef.current = playback;
  mutedRef.current = muted;

  function applyPlayback(player: YouTubePlayer) {
    const currentPlayback = playbackRef.current;

    const targetSeconds = Math.max(0, expectedPosition(currentPlayback));

    const duration = player.getDuration();

    const boundedTarget =
      duration > 0 ? Math.min(targetSeconds, duration) : targetSeconds;

    const currentSeconds = player.getCurrentTime();

    if (
      !Number.isFinite(currentSeconds) ||
      Math.abs(currentSeconds - boundedTarget) > 1.5
    ) {
      player.seekTo(boundedTarget, true);
    }

    if (currentPlayback.status === "PLAYING") {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }

  useImperativeHandle(ref, () => ({
    getCurrentTime() {
      const currentTime = playerRef.current?.getCurrentTime();

      return typeof currentTime === "number" && Number.isFinite(currentTime)
        ? Math.max(0, currentTime)
        : Math.max(0, expectedPosition(playbackRef.current));
    },

    play() {
      playerRef.current?.playVideo();
    },
  }));

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

              setReady(true);
              applyPlayback(event.target);
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

    // A new track ID remounts this component in RoomMusic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;

    if (!player || !ready) {
      return;
    }

    applyPlayback(player);

    // Apply only authoritative state changes, not a timer-based loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.status, playback.positionSeconds, playback.updatedAt, ready]);

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
              playerRef.current?.playVideo();
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
