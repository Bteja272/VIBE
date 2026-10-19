/* eslint-disable @next/next/no-img-element */

"use client";

import SharedYouTubePlayer, {
  type MusicPlaybackState,
} from "@/components/shared-youtube-player";
import type { RoomBoardState } from "@/src/types/board";

interface RoomBoardSurfaceProps {
  state: RoomBoardState | null;
  hidden?: boolean;
  linkedPlayback?: MusicPlaybackState | null;
  className?: string;
  showPlaceholder?: boolean;
}

export default function RoomBoardSurface({
  state,
  hidden = false,
  linkedPlayback = null,
  className = "",
  showPlaceholder = false,
}: RoomBoardSurfaceProps) {
  const media = state?.media ?? null;

  if (hidden) {
    return null;
  }

  if (!media) {
    if (!showPlaceholder) {
      return null;
    }

    return (
      <div
        className={`pointer-events-none flex items-center justify-center overflow-hidden bg-neutral-950 ${className}`}
        aria-hidden="true"
      >
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
            VIBE
          </p>
          <p className="mt-1 text-xs text-neutral-500">shared space</p>
        </div>
      </div>
    );
  }

  if (media.type === "IMAGE") {
    return (
      <div
        className={`pointer-events-none overflow-hidden bg-black ${className}`}
        aria-label={media.title || "Shared room image"}
      >
        <img
          src={media.url}
          alt={media.title || "Shared room image"}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  if (!media.videoId) {
    return null;
  }

  const playback: MusicPlaybackState = linkedPlayback ?? {
    status: "PLAYING",
    positionSeconds: 0,
    updatedAt: state?.updatedAt ?? new Date().toISOString(),
  };

  return (
    <div
      className={`pointer-events-none overflow-hidden bg-black ${className}`}
      aria-label={media.title || "Shared room video"}
    >
      <SharedYouTubePlayer
        key={`${media.videoId}:${linkedPlayback ? "music" : "board"}`}
        videoId={media.videoId}
        playback={playback}
        title={media.title || "Shared room video"}
        muted
        embedded
      />
    </div>
  );
}
