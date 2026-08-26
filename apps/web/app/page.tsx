import Link from "next/link";

import { getRooms } from "@/src/lib/api";

export default async function HomePage() {
  const rooms = await getRooms();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10">
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-neutral-500">
            VIBE
          </p>

          <h1 className="text-4xl font-semibold">
            Find your room
          </h1>

          <p className="mt-3 max-w-2xl text-neutral-400">
            Ambient spaces for studying, listening,
            hanging out, and playing together.
          </p>
        </header>

        {rooms.length === 0 ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
            <h2 className="text-xl font-medium">
              No rooms yet
            </h2>

            <p className="mt-2 text-neutral-400">
              Create the first VIBE room.
            </p>
          </section>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.slug}`}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition hover:border-neutral-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-xl font-medium">
                    {room.name}
                  </h2>

                  <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
                    {room.visibility}
                  </span>
                </div>

                <p className="mt-3 min-h-12 text-sm text-neutral-400">
                  {room.description ??
                    "No description provided."}
                </p>

                <div className="mt-6 flex items-center justify-between text-sm text-neutral-500">
                  <span>
                    {room.memberships.length}{" "}
                    {room.memberships.length === 1
                      ? "member"
                      : "members"}
                  </span>

                  <span>
                    {room.owner.displayName ??
                      room.owner.email}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}