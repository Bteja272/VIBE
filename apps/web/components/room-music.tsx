"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

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
const MAX_POSITION_SECONDS = 86_400;
const PERSONAL_MUTE_KEY = "vibe_personal_music_muted";
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function expectedPosition(playback: MusicPlaybackState): number {
  if (playback.status === "PAUSED") return playback.positionSeconds;
  const updatedAt = Date.parse(playback.updatedAt);
  return playback.positionSeconds +
    (Number.isFinite(updatedAt) ? Math.max(0, (Date.now() - updatedAt) / 1000) : 0);
}

function formatTime(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
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
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [personalMuted, setPersonalMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const playerRef = useRef<SharedYouTubePlayerHandle | null>(null);

  const canEditMusic = canControl && (isOwner || state?.permission === "ANY_MEMBER");
  const track = state?.track ?? null;
  const playback = state?.playback ?? null;
  const youtubeVideoId =
    track?.provider === "youtube" &&
    track.videoId &&
    YOUTUBE_VIDEO_ID_PATTERN.test(track.videoId)
      ? track.videoId
      : null;
  const hasSharedControls = Boolean(youtubeVideoId && track?.trackId && playback);
  const seekMaximum = Math.min(MAX_POSITION_SECONDS, Math.max(0, duration));
  const shownSeconds = Math.min(
    seekMaximum || MAX_POSITION_SECONDS,
    seekPreview ?? currentSeconds,
  );

  useEffect(() => {
    try {
      setPersonalMuted(window.sessionStorage.getItem(PERSONAL_MUTE_KEY) === "true");
    } catch {
      // Personal mute still works when session storage is disabled.
    }
  }, []);

  useEffect(() => {
    setState(null);
    setError(null);

    let active = true;
    function handleMusicUpdate(incoming: RoomMusicState) {
      if (active && incoming.roomId === roomId) setState(incoming);
    }
    function loadMusicState() {
      socket.timeout(SOCKET_TIMEOUT_MS).emit(
        "music:get",
        undefined,
        (timeoutError: Error | null, response?: MusicActionResponse) => {
          if (!timeoutError && active && response?.ok && response.state?.roomId === roomId) {
            setState(response.state);
          }
        },
      );
    }

    socket.on("music:update", handleMusicUpdate);
    socket.on("connect", loadMusicState);
    if (socket.connected) loadMusicState();
    return () => {
      active = false;
      socket.off("music:update", handleMusicUpdate);
      socket.off("connect", loadMusicState);
    };
  }, [roomId]);

  // Refresh the display only. Redis remains the source of truth for playback.
  useEffect(() => {
    setDuration(0);
    setCurrentSeconds(playback ? expectedPosition(playback) : 0);
    setSeekPreview(null);
  }, [track?.trackId, track?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playback || !youtubeVideoId) return;
    const refresh = () => {
      const reportedDuration = playerRef.current?.getDuration() ?? 0;
      if (reportedDuration > 0) setDuration(reportedDuration);
      const localTime = playerRef.current?.getCurrentTime();
      const time = typeof localTime === "number" && Number.isFinite(localTime)
        ? localTime
        : expectedPosition(playback);
      setCurrentSeconds(Math.max(0, time));
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [playback, youtubeVideoId]);

  function shareTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:set",
      { url: url.trim(), title: title.trim() || undefined },
      (timeoutError: Error | null, response?: MusicActionResponse) => {
        setLoading(false);
        if (timeoutError || !response?.ok) {
          setError(timeoutError ? "The server did not respond." : response?.error ?? "Unable to share music");
          return;
        }
        setUrl("");
        setTitle("");
        setSharingOpen(false);
        if (response.state?.roomId === roomId) setState(response.state);
      },
    );
  }

  function clearTrack() {
    if (loading) return;
    setLoading(true);
    setError(null);
    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:clear",
      undefined,
      (timeoutError: Error | null, response?: MusicActionResponse) => {
        setLoading(false);
        if (timeoutError || !response?.ok) {
          setError(timeoutError ? "The server did not respond." : response?.error ?? "Unable to clear music");
        } else if (response.state?.roomId === roomId) {
          setState(response.state);
        }
      },
    );
  }

  function changePermission(permission: MusicPermission) {
    setError(null);
    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:permission",
      { permission },
      (timeoutError: Error | null, response?: MusicActionResponse) => {
        if (timeoutError || !response?.ok) {
          setError(timeoutError ? "The server did not respond." : response?.error ?? "Unable to change permission");
        } else if (response.state?.roomId === roomId) {
          setState(response.state);
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
        // Keep the preference in component state.
      }
      return next;
    });
  }

  function sendPlaybackCommand(action: PlaybackAction, positionSeconds: number) {
    if (!canEditMusic || !track?.trackId || !playback || playbackLoading || loading || !Number.isFinite(positionSeconds)) return;
    setPlaybackLoading(true);
    setError(null);
    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "music:playback",
      {
        trackId: track.trackId,
        action,
        positionSeconds: Math.max(0, Math.min(MAX_POSITION_SECONDS, positionSeconds)),
      },
      (timeoutError: Error | null, response?: MusicActionResponse) => {
        setPlaybackLoading(false);
        if (timeoutError || !response?.ok) {
          setError(timeoutError ? "The server did not respond to the playback command." : response?.error ?? "Unable to update playback");
        } else if (response.state?.roomId === roomId) {
          setState(response.state);
        }
      },
    );
  }

  function toggleSharedPlayback() {
    if (!playback || !canEditMusic || playbackLoading) return;
    const action = playback.status === "PLAYING" ? "PAUSE" : "PLAY";
    const localPosition = playerRef.current?.getCurrentTime();
    const position = typeof localPosition === "number" && Number.isFinite(localPosition)
      ? localPosition
      : expectedPosition(playback);
    // A direct user gesture helps the controlling browser pass autoplay policies.
    if (action === "PLAY") playerRef.current?.play();
    sendPlaybackCommand(action, position);
  }

  function commitSeek(value: number) {
    setSeekPreview(null);
    if (!canEditMusic || !playback || !duration) return;
    sendPlaybackCommand("SEEK", Math.min(duration, Math.max(0, value)));
  }

  return (
    <section className={compact ? "min-w-0 text-neutral-100" : "rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-neutral-100"}>
      {!compact && <h2 className="mb-3 text-lg font-semibold">Shared music</h2>}

      <div className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        {track ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800">♪</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{track.title || "Shared track"}</p>
                <p className="truncate text-xs text-neutral-500">Shared by {track.sharedBy}</p>
              </div>
              {playback && <span className="shrink-0 text-[11px] text-neutral-400">{playback.status === "PLAYING" ? "Playing" : "Paused"}</span>}
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
                        {playback.status === "PLAYING" ? "Pause for everyone" : "Play for everyone"}
                      </button>
                      <button
                        type="button"
                        onClick={togglePersonalMute}
                        aria-label={personalMuted ? "Unmute shared music for me" : "Mute shared music for me"}
                        title={personalMuted ? "Unmute for me" : "Mute for me"}
                        aria-pressed={personalMuted}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 text-lg transition hover:bg-neutral-800"
                      >
                        <span aria-hidden="true">{personalMuted ? "🔇" : "🔊"}</span>
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
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">{formatTime(shownSeconds)}</span>
                      <input
                        type="range"
                        min={0}
                        max={seekMaximum || 1}
                        step={1}
                        value={Math.min(seekMaximum || 1, Math.max(0, seekPreview ?? currentSeconds))}
                        onChange={(event) => setSeekPreview(Number(event.target.value))}
                        onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
                        onKeyUp={(event) => {
                          if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
                            commitSeek(Number(event.currentTarget.value));
                          }
                        }}
                        disabled={!canEditMusic || loading || playbackLoading || !duration}
                        aria-label="Seek shared music"
                        title={canEditMusic ? "Seek for everyone" : "Only an authorized participant can seek"}
                        className="min-w-0 flex-1 accent-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      <span className="w-9 shrink-0 text-[11px] tabular-nums text-neutral-400">{duration > 0 ? formatTime(duration) : "--:--"}</span>
                    </div>
                    {!canEditMusic && <p className="text-xs text-neutral-500">Only an authorized participant can change room playback. Your mute is personal.</p>}
                  </div>
                )}
                {!track.trackId && <p className="mt-2 text-xs text-amber-300">Share this track again to enable shared controls.</p>}
              </div>
            )}

            {!youtubeVideoId && (
              <a href={track.url} target="_blank" rel="noopener noreferrer" className="mt-3 block truncate rounded-lg border border-neutral-700 px-3 py-2 text-center text-sm hover:bg-neutral-800">
                Open shared link ↗
              </a>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-neutral-400">Nothing shared yet.</p>
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
            <span aria-hidden="true" className="text-neutral-400">{sharingOpen ? "−" : "+"}</span>
          </button>
          {sharingOpen && (
            <div id={`music-sharing-${roomId}`} className="space-y-3 border-t border-neutral-800 p-3">
              {isOwner && (
                <label className="block text-xs text-neutral-400">
                  Who can share music?
                  <select
                    value={state?.permission ?? "OWNER_ONLY"}
                    onChange={(event) => changePermission(event.target.value as MusicPermission)}
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
                    <button type="submit" disabled={loading || !url.trim()} className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50">
                      {loading ? "Sharing..." : "Share track"}
                    </button>
                    {track && (
                      <button type="button" onClick={clearTrack} disabled={loading} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50">
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

      {!canControl && <p className="mt-3 text-xs text-neutral-500">Join the room to share music.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
