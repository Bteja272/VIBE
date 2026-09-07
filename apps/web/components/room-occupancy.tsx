"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  socket,
} from "@/src/lib/socket";

interface RoomOccupancyProps {
  roomId: string;
  capacity?: number;
}

interface PresenceUpdate {
  roomId: string;
  count: number;
}

export default function RoomOccupancy({
  roomId,
  capacity = 12,
}: RoomOccupancyProps) {
  const [
    count,
    setCount,
  ] = useState(0);

  useEffect(() => {
    function handlePresenceUpdate(
      update:
        PresenceUpdate,
    ) {
      if (
        update.roomId !==
        roomId
      ) {
        return;
      }

      setCount(
        update.count,
      );
    }

    socket.on(
      "presence:update",
      handlePresenceUpdate,
    );

    return () => {
      socket.off(
        "presence:update",
        handlePresenceUpdate,
      );
    };
  }, [roomId]);

  const isFull =
    count >= capacity;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          People here
        </p>

        {isFull && (
          <span className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-400">
            Full
          </span>
        )}
      </div>

      <p className="mt-2 text-2xl font-semibold">
        {count} /{" "}
        {capacity}
      </p>
    </div>
  );
}