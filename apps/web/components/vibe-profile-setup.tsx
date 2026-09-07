"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getVibeToken,
  updateVibeProfile,
} from "@/src/lib/api";

export default function VibeProfileSetup() {
  const router =
    useRouter();

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        const auth =
          await getVibeToken();

        if (
          cancelled
        ) {
          return;
        }

        if (
          auth.profileCompleted
        ) {
          router.replace("/");
          return;
        }

        setDisplayName(
          auth.user.displayName ??
            "",
        );
      } catch (
        err
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load profile",
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [
    router,
  ]);

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

    setSaving(
      true,
    );

    setError(
      null,
    );

    try {
      const auth =
        await getVibeToken();

      await updateVibeProfile(
        normalized,
        auth.token,
      );

      router.push("/");
      router.refresh();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save profile",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <p className="text-sm text-neutral-500">
        Loading profile...
      </p>
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
    >
      <div>
        <label
          htmlFor="vibe-display-name"
          className="block text-sm font-medium"
        >
          Display name
        </label>

        <input
          id="vibe-display-name"
          value={
            displayName
          }
          onChange={(
            event,
          ) =>
            setDisplayName(
              event.target.value,
            )
          }
          minLength={
            2
          }
          maxLength={
            24
          }
          required
          autoFocus
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
          placeholder="Bhanu"
        />

        <p className="mt-2 text-xs text-neutral-500">
          2–24 characters. Letters, numbers,
          spaces, underscores and hyphens.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          saving
        }
        className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-medium text-neutral-950 disabled:opacity-50"
      >
        {saving
          ? "Saving..."
          : "Enter VIBE"}
      </button>
    </form>
  );
}