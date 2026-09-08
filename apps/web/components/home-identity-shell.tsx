"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import GuestEntry from "@/components/guest-entry";
import VibeAvatar from "@/components/vibe-avatar";

import {
  clearGuestSession,
  getGuestSession,
  type GuestSession,
} from "@/src/lib/guest-auth";

interface HomeIdentityShellProps {
  googleControl:
    ReactNode;
}

export default function HomeIdentityShell({
  googleControl,
}: HomeIdentityShellProps) {
  const [
    guest,
    setGuest,
  ] =
    useState<
      GuestSession | null
    >(null);

  const [
    loaded,
    setLoaded,
  ] =
    useState(false);

  useEffect(() => {
    setGuest(
      getGuestSession(),
    );

    setLoaded(
      true,
    );
  }, []);

  function handleGuestStarted(
    session:
      GuestSession,
  ) {
    setGuest(
      session,
    );
  }

  function handleExitGuest() {
    clearGuestSession();

    setGuest(
      null,
    );
  }

  /*
   * Avoid briefly flashing the sign-in
   * cards while sessionStorage loads.
   */
  if (
    !loaded
  ) {
    return (
      <section className="py-10">
        <p className="text-sm text-neutral-500">
          Loading identity...
        </p>
      </section>
    );
  }

  if (
    guest
  ) {
    return (
      <section className="flex justify-end py-6">
        <div className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4">
          <VibeAvatar
            avatarId={
              guest.user
                .avatarId
            }
            size="sm"
          />

          <div>
            <p className="text-sm font-medium">
              {
                guest.user
                  .displayName
              }
            </p>

            <p className="text-xs text-neutral-500">
              Guest
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleExitGuest
            }
            className="ml-3 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100"
          >
            Exit guest
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          Enter VIBE
        </h2>

        <p className="mt-2 text-sm text-neutral-500">
          Use an account for persistent rooms,
          or jump in as a guest.
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
            {
              googleControl
            }
          </div>
        </div>

        <GuestEntry
          onSessionCreated={
            handleGuestStarted
          }
        />
      </div>
    </section>
  );
}