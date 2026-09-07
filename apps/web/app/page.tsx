import Link from "next/link";

import {
  auth,
} from "@/auth";

import AuthControls from "@/components/auth-controls";
import GuestEntry from "@/components/guest-entry";

import {
  getRooms,
} from "@/src/lib/api";

export default async function HomePage() {
  const [
    rooms,
    session,
  ] =
    await Promise.all([
      getRooms(),
      auth(),
    ]);

  const isSignedIn =
    Boolean(
      session?.user,
    );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="border-b border-neutral-800 pb-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-neutral-500">
                VIBE
              </p>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Find your room.
                Stay for the vibe.
              </h1>

              <p className="mt-4 max-w-2xl text-neutral-400">
                Ambient spaces for studying,
                listening, hanging out, and
                playing together.
              </p>
            </div>

            {isSignedIn && (
              <div className="flex flex-wrap items-center gap-3">
                <AuthControls />

                <Link
                  href="/rooms/new"
                  className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
                >
                  Create room
                </Link>
              </div>
            )}
          </div>
        </header>

        {!isSignedIn && (
          <section className="py-10">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">
                Enter VIBE
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                Use an account for persistent
                rooms, or jump in as a guest.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Persistent identity
                </p>

                <h2 className="mt-2 text-lg font-medium">
                  Continue with Google
                </h2>

                <p className="mt-1 min-h-10 text-sm text-neutral-500">
                  Create rooms, keep memberships,
                  and preserve your VIBE profile.
                </p>

                <div className="mt-4">
                  <AuthControls />
                </div>
              </div>

              <GuestEntry />
            </div>
          </section>
        )}

        <section
          className={
            isSignedIn
              ? "pt-10"
              : "border-t border-neutral-800 pt-10"
          }
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Rooms
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Explore spaces
              </h2>
            </div>

            {!isSignedIn && (
              <p className="hidden text-sm text-neutral-500 sm:block">
                Guests can join any accessible
                room.
              </p>
            )}
          </div>

          {rooms.length ===
          0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
              <h3 className="text-xl font-medium">
                No rooms yet
              </h3>

              <p className="mt-2 text-neutral-400">
                Sign in with Google to create
                the first VIBE room.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map(
                (
                  room,
                ) => (
                  <Link
                    key={
                      room.id
                    }
                    href={`/rooms/${room.slug}`}
                    className="group rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition hover:border-neutral-600"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl font-medium">
                        {
                          room.name
                        }
                      </h3>

                      <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
                        {
                          room.visibility
                        }
                      </span>
                    </div>

                    <p className="mt-3 min-h-12 text-sm text-neutral-400">
                      {room.description ??
                        "No description provided."}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-4 text-sm text-neutral-500">
                      <span>
                        {
                          room.memberCount
                        }{" "}
                        {room.memberCount ===
                        1
                          ? "member"
                          : "members"}
                      </span>

                      <span className="truncate">
                        {room.owner
                          .displayName ??
                          room.owner
                            .email}
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-neutral-400 transition group-hover:text-neutral-200">
                      Open room →
                    </p>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}