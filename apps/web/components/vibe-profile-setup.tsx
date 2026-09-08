"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import AvatarPicker from "@/components/avatar-picker";
import VibeAvatar from "@/components/vibe-avatar";

import {
  DEFAULT_VIBE_AVATAR,
  type VibeAvatarId,
} from "@/src/lib/avatars";

import {
  getVibeToken,
  updateVibeAvatar,
  updateVibeProfile,
} from "@/src/lib/api";

export default function VibeProfileSetup() {
  const router =
    useRouter();

  const [
    displayName,
    setDisplayName,
  ] =
    useState("");

  const [
    avatarId,
    setAvatarId,
  ] =
    useState<VibeAvatarId>(
      DEFAULT_VIBE_AVATAR,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
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

        /*
         * A profile is fully ready for
         * Milestone 1C only when it has
         * both a completed name profile
         * and a VIBE avatar.
         */
        if (
          auth.profileCompleted &&
          auth.user.avatarId
        ) {
          router.replace(
            "/",
          );

          return;
        }

        setDisplayName(
          auth.user.displayName ??
            "",
        );

        if (
          auth.user.avatarId
        ) {
          setAvatarId(
            auth.user.avatarId as
              VibeAvatarId,
          );
        }
      } catch (
        err
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          err instanceof
            Error
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

      /*
       * Updating the name issues a new
       * JWT, so use that returned token
       * for the avatar request.
       */
      const profile =
        await updateVibeProfile(
          normalized,
          auth.token,
        );

      await updateVibeAvatar(
        avatarId,
        profile.token,
      );

      router.push(
        "/",
      );

      router.refresh();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
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
      className="space-y-7 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
    >
      <div className="flex items-center gap-4">
        <VibeAvatar
          avatarId={
            avatarId
          }
          size="xl"
        />

        <div>
          <p className="text-sm text-neutral-500">
            Your VIBE identity
          </p>

          <p className="mt-1 text-lg font-medium">
            {displayName.trim() ||
              "Choose your name"}
          </p>
        </div>
      </div>

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
          autoFocus
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
          placeholder="Your VIBE name"
        />

        <p className="mt-2 text-xs text-neutral-500">
          2–24 characters. Letters,
          numbers, spaces, underscores
          and hyphens.
        </p>
      </div>

      <AvatarPicker
        value={
          avatarId
        }
        onChange={
          setAvatarId
        }
        disabled={
          saving
        }
      />

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
        className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
      >
        {saving
          ? "Saving..."
          : "Enter VIBE"}
      </button>
    </form>
  );
}