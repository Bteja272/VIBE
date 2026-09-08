"use client";

import VibeAvatar from "@/components/vibe-avatar";

import {
  assignParticipantsToSeats,
  type SpatialParticipant,
} from "@/src/lib/spatial-layout";

interface SpatialRoomProps {
  users:
    SpatialParticipant[];

  connected:
    boolean;

  capacity?: number;
}

export default function SpatialRoom({
  users,
  connected,
  capacity = 12,
}: SpatialRoomProps) {
  const seats =
    assignParticipantsToSeats(
      users,
    );

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Spatial room
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            People in this space
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-sm text-neutral-500">
            {users.length}/{capacity}
          </p>

          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected
                  ? "bg-green-400"
                  : "bg-neutral-600"
              }`}
            />

            <span className="text-sm text-neutral-500">
              {connected
                ? "Live"
                : "Offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="relative min-h-[520px] overflow-hidden bg-neutral-950 sm:min-h-[620px]">
        {/* Back wall */}
        <div className="absolute inset-x-0 top-0 h-[36%] border-b border-neutral-800 bg-neutral-900/60" />

        {/* Simple room focal point */}
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-950 px-8 py-3 text-center shadow-lg">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
              VIBE
            </p>

            <p className="mt-1 text-sm text-neutral-400">
              shared space
            </p>
          </div>
        </div>

        {/* Floor guides */}
        <div className="absolute inset-x-[8%] bottom-[12%] top-[30%] rounded-[3rem] border border-neutral-800/70 bg-neutral-900/30" />

        <div className="absolute left-1/2 top-[30%] h-[58%] w-px -translate-x-1/2 bg-neutral-800/40" />

        <div className="absolute left-[8%] right-[8%] top-[56%] h-px bg-neutral-800/40" />

        {users.length ===
        0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-neutral-700 text-2xl">
                ?
              </div>

              <p className="mt-4 font-medium text-neutral-300">
                This room is quiet.
              </p>

              <p className="mt-1 text-sm text-neutral-600">
                Join the room to take a seat.
              </p>
            </div>
          </div>
        ) : (
          seats.map(
            ({
              participant,
              position,
            }) => (
              <div
                key={
                  participant.userId
                }
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-out"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                }}
              >
                <div className="group flex w-24 flex-col items-center sm:w-28">
                  <div className="relative">
                    {/* Seat shadow */}
                    <div className="absolute left-1/2 top-[82%] h-5 w-16 -translate-x-1/2 rounded-full bg-black/30 blur-md" />

                    <div className="relative transition-transform duration-200 group-hover:-translate-y-1">
                      <VibeAvatar
                        avatarId={
                          participant.avatarId
                        }
                        size="lg"
                      />
                    </div>

                    <span className="absolute -right-1 bottom-1 h-3 w-3 rounded-full border-2 border-neutral-950 bg-green-400" />
                  </div>

                  <div className="relative mt-2 max-w-full rounded-lg border border-neutral-800 bg-neutral-950/90 px-3 py-1.5 text-center shadow-lg backdrop-blur">
                    <p className="truncate text-sm font-medium">
                      {
                        participant.displayName
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                      {participant.identityType ===
                      "GUEST"
                        ? "Guest"
                        : "Registered"}
                    </p>
                  </div>
                </div>
              </div>
            ),
          )
        )}
      </div>

      <div className="border-t border-neutral-800 px-6 py-4">
        <p className="text-xs text-neutral-600">
          Seats currently adapt automatically
          to active occupancy.
        </p>
      </div>
    </section>
  );
}