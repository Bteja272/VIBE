"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  clearGuestSession,
  createGuestSession,
  getGuestSession,
  type GuestSession,
} from "@/src/lib/guest-auth";

export default function GuestEntry() {
  const [
    session,
    setSession,
  ] =
    useState<
      GuestSession | null
    >(null);

  const [
    displayName,
    setDisplayName,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    const existing =
      getGuestSession();

    setSession(
      existing,
    );

    if (existing) {
      setDisplayName(
        existing.user
          .displayName,
      );
    }
  }, []);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalized =
      displayName.trim();

    if (
      normalized.length <
      2
    ) {
      setError(
        "Display name must be at least 2 characters",
      );

      return;
    }

    setLoading(
      true,
    );

    setError(
      null,
    );

    try {
      const guest =
        await createGuestSession(
          normalized,
        );

      setSession(
        guest,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to continue as guest",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  function handleReset() {
    clearGuestSession();

    setSession(
      null,
    );

    setDisplayName(
      "",
    );

    setError(
      null,
    );
  }

  if (session) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          Guest session
        </p>

        <p className="mt-2 text-lg font-medium">
          Continue as{" "}
          {
            session.user
              .displayName
          }
        </p>

        <p className="mt-1 text-sm text-neutral-500">
          You can browse and join rooms without
          signing in.
        </p>

        <button
          type="button"
          onClick={
            handleReset
          }
          className="mt-4 text-sm text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
        >
          Use a different name
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        No account needed
      </p>

      <h2 className="mt-2 text-lg font-medium">
        Continue as Guest
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        Choose the name other people will see
        inside rooms.
      </p>

      <input
        value={
          displayName
        }
        onChange={(
          event,
        ) =>
          setDisplayName(
            event.target
              .value,
          )
        }
        minLength={
          2
        }
        maxLength={
          24
        }
        required
        placeholder="Your VIBE name"
        className="mt-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
      />

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          loading
        }
        className="mt-4 w-full rounded-lg border border-neutral-700 px-4 py-3 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50"
      >
        {loading
          ? "Starting guest session..."
          : "Continue as Guest"}
      </button>
    </form>
  );
}