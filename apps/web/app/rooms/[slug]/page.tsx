import Link from "next/link";

import { notFound } from "next/navigation";

import { auth } from "@/auth";

import OwnerRoomActions from "@/components/owner-room-actions";
import RoomActions from "@/components/room-actions";
import RoomChat from "@/components/room-chat";
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
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="text-sm text-neutral-400 transition hover:text-neutral-100"
        >
          ← Back to rooms
        </Link>

        <header className="mt-8 border-b border-neutral-800 pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-neutral-500">
                VIBE Room
              </p>

              <h1 className="text-4xl font-semibold">{room.name}</h1>

              <p className="mt-3 max-w-2xl text-neutral-400">
                {room.description ?? "No description provided."}
              </p>

              <div className="mt-6">
                <RoomActions
                  roomId={room.id}
                  isMember={isMember}
                  isOwner={isOwner}
                  isSignedIn={isSignedIn}
                />
              </div>

              {isOwner && (
                <section className="mb-8 mt-8">
                  <h2 className="mb-4 text-xl font-semibold">Owner controls</h2>

                  <OwnerRoomActions
                    roomId={room.id}
                    initialName={room.name}
                    initialDescription={room.description}
                    initialVisibility={room.visibility}
                  />
                </section>
              )}

              <section className="mt-8">
                <RoomPresence
                  roomId={room.id}
                  shouldBePresent={isOwner || isMember}
                />
              </section>

              <section className="mt-8">
                <RoomMusic
                  roomId={room.id}
                  isOwner={isOwner}
                  canControl={true}
                />
              </section>

              <section className="mt-8">
                <RoomChat roomId={room.id} canSend={true} />
              </section>
            </div>

            <span className="w-fit rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
              {room.visibility}
            </span>
          </div>
        </header>

        <section className="grid gap-6 py-8 md:grid-cols-3">
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
            <p className="text-sm text-neutral-500">Room ID</p>

            <p className="mt-2 break-all text-sm text-neutral-300">{room.id}</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">Members</h2>

          <p className="mt-2 text-sm text-neutral-500">
            Registered memberships are persistent. Guests appear in Live
            presence instead.
          </p>

          <div className="mt-5 space-y-3">
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
