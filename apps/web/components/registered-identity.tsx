"use client";

import {
  useEffect,
  useState,
} from "react";

import VibeAvatar from "@/components/vibe-avatar";

import {
  getVibeToken,
  type VibeTokenResponse,
} from "@/src/lib/api";

export default function RegisteredIdentity() {
  const [
    auth,
    setAuth,
  ] =
    useState<
      VibeTokenResponse | null
    >(null);

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        const result =
          await getVibeToken();

        if (
          !cancelled
        ) {
          setAuth(
            result,
          );
        }
      } catch {
        /*
         * AuthControls still gives the
         * user a way to sign out if the
         * VIBE profile cannot be loaded.
         */
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, []);

  if (
    !auth
  ) {
    return (
      <div>
        <p className="text-sm font-medium">
          VIBE account
        </p>

        <p className="text-xs text-neutral-500">
          Registered
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <VibeAvatar
        avatarId={
          auth.user.avatarId
        }
        size="sm"
      />

      <div>
        <p className="text-sm font-medium text-neutral-100">
          {
            auth.user
              .displayName
          }
        </p>

        <p className="text-xs text-neutral-500">
          Registered
        </p>
      </div>
    </div>
  );
}