import {
  getVibeAvatar,
} from "@/src/lib/avatars";

interface VibeAvatarProps {
  avatarId?: string;

  size?:
    | "sm"
    | "md"
    | "lg"
    | "xl";

  showLabel?: boolean;
}

const sizeClasses = {
  sm: "h-9 w-9 text-xl",
  md: "h-12 w-12 text-2xl",
  lg: "h-16 w-16 text-3xl",
  xl: "h-24 w-24 text-5xl",
};

export default function VibeAvatar({
  avatarId,
  size = "md",
  showLabel = false,
}: VibeAvatarProps) {
  const avatar =
    getVibeAvatar(
      avatarId,
    );

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 ${sizeClasses[size]}`}
        title={
          avatar.label
        }
      >
        <span
          aria-hidden="true"
        >
          {avatar.emoji}
        </span>

        <span className="sr-only">
          {avatar.label} avatar
        </span>
      </div>

      {showLabel && (
        <span className="text-xs text-neutral-500">
          {avatar.label}
        </span>
      )}
    </div>
  );
}