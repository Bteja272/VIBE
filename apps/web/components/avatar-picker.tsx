"use client";

import VibeAvatar from "@/components/vibe-avatar";

import {
  VIBE_AVATARS,
  type VibeAvatarId,
} from "@/src/lib/avatars";

interface AvatarPickerProps {
  value:
    VibeAvatarId;

  onChange: (
    avatarId:
      VibeAvatarId,
  ) => void;

  disabled?: boolean;
}

export default function AvatarPicker({
  value,
  onChange,
  disabled = false,
}: AvatarPickerProps) {
  return (
    <div>
      <p className="text-sm font-medium">
        Choose your avatar
      </p>

      <p className="mt-1 text-xs text-neutral-500">
        This is how other people will
        recognize you inside VIBE.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {VIBE_AVATARS.map(
          (avatar) => {
            const selected =
              value ===
              avatar.id;

            return (
              <button
                key={
                  avatar.id
                }
                type="button"
                disabled={
                  disabled
                }
                onClick={() =>
                  onChange(
                    avatar.id,
                  )
                }
                aria-pressed={
                  selected
                }
                className={`rounded-xl border p-3 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-neutral-200 bg-neutral-800"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-600"
                }`}
              >
                <VibeAvatar
                  avatarId={
                    avatar.id
                  }
                  size="lg"
                />

                <p className="mt-2 text-xs text-neutral-400">
                  {
                    avatar.label
                  }
                </p>
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}