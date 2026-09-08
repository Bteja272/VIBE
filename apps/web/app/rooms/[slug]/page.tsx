import Link from "next/link";

import { notFound } from "next/navigation";

import { auth } from "@/auth";

import OwnerRoomActions from "@/components/owner-room-actions";
import RoomActions from "@/components/room-actions";
import RoomMusic from "@/components/room-music";
import RoomOccupancy from "@/components/room-occupancy";
import RoomPresence from "@/components/room-presence";
import VibeAvatar from "@/components/vibe-avatar";

import { getRoomBySlug } from "@/src/lib/api";

interface RoomPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { slug } = await params;

  const [room, session] = await Promise.all([getRoomBySlug(slug), auth()]);

  if (!room) {
    notFound();
  }

  const currentUserEmail = session?.user?.email ?? null;

  const currentMembership = currentUserEmail
    ? room.memberships.find(
        (membership) => membership.user.email === currentUserEmail,
      )
    : undefined;

  const isMember = Boolean(currentMembership);

  const isOwner = Boolean(
    currentUserEmail && room.owner.email === currentUserEmail,
  );

  const isSignedIn = Boolean(currentUserEmail);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/"
          className="text-sm text-neutral-400 transition hover:text-neutral-100"
        >
          ← Back to rooms
        </Link>

        <header className="mt-8 border-b border-neutral-800 pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                  VIBE Room
                </p>

                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
                  {room.visibility}
                </span>
              </div>

              <h1 className="mt-3 text-4xl font-semibold">{room.name}</h1>

              <p className="mt-3 max-w-2xl text-neutral-400">
                {room.description ?? "No description provided."}
              </p>
            </div>

            <RoomActions
              roomId={room.id}
              isMember={isMember}
              isOwner={isOwner}
              isSignedIn={isSignedIn}
            />
          </div>
        </header>

        {/* Main spatial experience */}
        <section className="mt-8">
          <RoomPresence
            roomId={room.id}
            shouldBePresent={isOwner || isMember}
          />
        </section>

        {/* Room metadata */}
        <section className="grid gap-5 py-8 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">Owner</p>

            <div className="mt-3 flex items-center gap-3">
              <VibeAvatar
                avatarId={room.owner.avatarId ?? undefined}
                size="sm"
              />

              <div>
                <p className="font-medium">
                  {room.owner.displayName ?? "VIBE user"}
                </p>

                <p className="text-xs text-neutral-500">Registered</p>
              </div>
            </div>
          </div>

          <RoomOccupancy roomId={room.id} capacity={room.capacity} />

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">Persistent members</p>

            <p className="mt-2 text-2xl font-semibold">{room.memberCount}</p>

            <p className="mt-1 text-xs text-neutral-600">
              Guests are not persisted.
            </p>
          </div>
        </section>

        {/* Realtime tools */}
        <section className="grid gap-6 lg:grid-cols-2">
          <RoomMusic roomId={room.id} isOwner={isOwner} canControl={true} />
        </section>

        {isOwner && (
          <section className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">Owner controls</h2>

            <OwnerRoomActions
              roomId={room.id}
              initialName={room.name}
              initialDescription={room.description}
              initialVisibility={room.visibility}
            />
          </section>
        )}

        {/* Persistent membership list */}
        <section className="mt-10 border-t border-neutral-800 pt-8">
          <h2 className="text-2xl font-semibold">Members</h2>

          <p className="mt-2 text-sm text-neutral-500">
            Registered memberships are persistent. Guests appear only while they
            are actively present.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {room.memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <VibeAvatar
                    avatarId={membership.user.avatarId ?? undefined}
                    size="sm"
                  />

                  <div>
                    <p className="font-medium">
                      {membership.user.displayName ?? "VIBE user"}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      Registered member
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
                  {membership.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
