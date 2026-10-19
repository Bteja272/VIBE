"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { socket } from "@/src/lib/socket";
import type { BoardMediaType, RoomBoardState } from "@/src/types/board";

interface RoomBoardProps {
  roomId: string;
  isOwner: boolean;
  canControl: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onStateChange?: (state: RoomBoardState | null) => void;
  hiddenForMe: boolean;
  onHiddenForMeChange: (hidden: boolean) => void;
}

interface BoardActionResponse {
  ok: boolean;
  state?: RoomBoardState;
  error?: string;
}

const SOCKET_TIMEOUT_MS = 5000;
const RECONNECT_SYNC_DELAYS_MS = [0, 250, 750, 1500];

function shouldAcceptState(
  current: RoomBoardState | null,
  incoming: RoomBoardState,
): boolean {
  if (!current) {
    return true;
  }

  return incoming.revision >= current.revision;
}

export default function RoomBoard({
  roomId,
  isOwner,
  canControl,
  open,
  onToggle,
  onClose,
  onStateChange,
  hiddenForMe,
  onHiddenForMeChange,
}: RoomBoardProps) {
  const [state, setState] = useState<RoomBoardState | null>(null);
  const stateRef = useRef<RoomBoardState | null>(null);

  const [mediaType, setMediaType] = useState<BoardMediaType>("IMAGE");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeState = state?.roomId === roomId ? state : null;
  const media = activeState?.media ?? null;

  const acceptState = useCallback(
    (incoming: RoomBoardState) => {
      if (incoming.roomId !== roomId) {
        return;
      }

      const current =
        stateRef.current?.roomId === roomId ? stateRef.current : null;

      if (!shouldAcceptState(current, incoming)) {
        return;
      }

      stateRef.current = incoming;
      setState(incoming);
      onStateChange?.(incoming);
    },
    [roomId, onStateChange],
  );

  useEffect(() => {
    let active = true;
    const retryTimers: number[] = [];

    function clearRetryTimers() {
      for (const timer of retryTimers) {
        window.clearTimeout(timer);
      }

      retryTimers.length = 0;
    }

    function loadBoardState() {
      if (!active || !socket.connected) {
        return;
      }

      socket.timeout(SOCKET_TIMEOUT_MS).emit(
        "board:get",
        undefined,
        (timeoutError: Error | null, response?: BoardActionResponse) => {
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
        retryTimers.push(window.setTimeout(loadBoardState, delay));
      }
    }

    function handleBoardUpdate(incoming: RoomBoardState) {
      if (!active) {
        return;
      }

      acceptState(incoming);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && socket.connected) {
        loadBoardState();
      }
    }

    socket.on("board:update", handleBoardUpdate);
    socket.on("connect", scheduleReconnectSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (socket.connected) {
      scheduleReconnectSync();
    }

    return () => {
      active = false;
      clearRetryTimers();
      socket.off("board:update", handleBoardUpdate);
      socket.off("connect", scheduleReconnectSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acceptState]);

  useEffect(() => {
    return () => {
      onStateChange?.(null);
    };
  }, [onStateChange]);

  function setBoardMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOwner || !canControl || !url.trim() || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "board:set",
      {
        type: mediaType,
        url: url.trim(),
        title: title.trim() || undefined,
      },
      (timeoutError: Error | null, response?: BoardActionResponse) => {
        setLoading(false);

        if (timeoutError || !response?.ok) {
          setError(
            timeoutError
              ? "The server did not respond."
              : (response?.error ?? "Unable to update the room screen"),
          );
          return;
        }

        setUrl("");
        setTitle("");

        if (response.state) {
          acceptState(response.state);
        }
      },
    );
  }

  function clearBoard() {
    if (!isOwner || !canControl || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    socket.timeout(SOCKET_TIMEOUT_MS).emit(
      "board:clear",
      undefined,
      (timeoutError: Error | null, response?: BoardActionResponse) => {
        setLoading(false);

        if (timeoutError || !response?.ok) {
          setError(
            timeoutError
              ? "The server did not respond."
              : (response?.error ?? "Unable to clear the room screen"),
          );
          return;
        }

        if (response.state) {
          acceptState(response.state);
        }
      },
    );
  }

  return (
    <>
      <div className="absolute left-[4.5rem] top-4 z-40">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/95 text-lg text-neutral-200 shadow-lg backdrop-blur transition hover:bg-neutral-800"
          aria-label={
            open ? "Close room screen controls" : "Open room screen controls"
          }
          title="Room screen"
        >
          <span aria-hidden="true">▣</span>

          {media && (
            <span
              aria-hidden="true"
              className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-neutral-900 ${
                hiddenForMe ? "bg-neutral-500" : "bg-green-400"
              }`}
            />
          )}
        </button>
      </div>

      {open && (
        <aside className="absolute bottom-3 left-3 right-3 top-16 z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl sm:bottom-auto sm:left-20 sm:right-auto sm:max-h-[min(36rem,calc(100%-5rem))] sm:w-[22rem]">
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-3">
            <div>
              <p className="font-medium">Room screen</p>
              <p className="text-xs text-neutral-500">
                Shared media on the room display
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
              aria-label="Close room screen controls"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
              {media ? (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {media.title ||
                          (media.type === "IMAGE"
                            ? "Shared image"
                            : "Shared video")}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        {media.type === "IMAGE" ? "Image" : "YouTube"} · set by{" "}
                        {media.updatedBy}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-400">
                      {hiddenForMe ? "Hidden" : "Visible"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onHiddenForMeChange(!hiddenForMe)}
                      className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 transition hover:bg-neutral-800"
                    >
                      {hiddenForMe
                        ? "Show room screen for me"
                        : "Hide room screen for me"}
                    </button>

                    <a
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      Open source ↗
                    </a>
                  </div>
                </div>
              ) : (
                <p className="py-3 text-center text-sm text-neutral-500">
                  The room screen is empty.
                </p>
              )}
            </div>

            {isOwner ? (
              <form onSubmit={setBoardMedia} className="mt-3 space-y-3">
                <label className="block text-xs text-neutral-400">
                  Media type
                  <select
                    value={mediaType}
                    onChange={(event) =>
                      setMediaType(event.target.value as BoardMediaType)
                    }
                    disabled={!canControl || loading}
                    className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-50"
                  >
                    <option value="IMAGE">Image URL</option>
                    <option value="YOUTUBE">YouTube video</option>
                  </select>
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Title (optional)"
                  maxLength={120}
                  disabled={!canControl || loading}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
                />

                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={
                    mediaType === "IMAGE"
                      ? "https://example.com/image.jpg"
                      : "https://www.youtube.com/watch?v=..."
                  }
                  required
                  disabled={!canControl || loading}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={!canControl || loading || !url.trim()}
                    className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? "Updating..."
                      : media
                        ? "Replace media"
                        : "Show media"}
                  </button>

                  {media && (
                    <button
                      type="button"
                      onClick={clearBoard}
                      disabled={!canControl || loading}
                      className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear screen
                    </button>
                  )}
                </div>

                {!canControl && (
                  <p className="text-xs text-neutral-500">
                    Join the room as the owner to change the screen.
                  </p>
                )}
              </form>
            ) : (
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Only the room owner can change what appears on the shared room
                screen. Your hide/show choice affects only this browser.
              </p>
            )}

            <p className="mt-3 text-[11px] leading-5 text-neutral-600">
              When the same YouTube video is also active in Shared Music, the
              room screen follows the shared play, pause, seek, and timestamp.
              The board copy stays muted so the music player remains the audio
              source.
            </p>

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
