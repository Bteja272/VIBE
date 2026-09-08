export const VIBE_AVATARS = [
  {
    id: "frog",
    label: "Frog",
    emoji: "🐸",
  },
  {
    id: "cat",
    label: "Cat",
    emoji: "🐱",
  },
  {
    id: "ghost",
    label: "Ghost",
    emoji: "👻",
  },
  {
    id: "blob",
    label: "Blob",
    emoji: "🫠",
  },
  {
    id: "robot",
    label: "Robot",
    emoji: "🤖",
  },
  {
    id: "duck",
    label: "Duck",
    emoji: "🦆",
  },
  {
    id: "alien",
    label: "Alien",
    emoji: "👽",
  },
  {
    id: "bear",
    label: "Bear",
    emoji: "🐻",
  },
] as const;

export type VibeAvatarId =
  (typeof VIBE_AVATARS)[number]["id"];

export const DEFAULT_VIBE_AVATAR:
  VibeAvatarId = "frog";

export function getVibeAvatar(
  avatarId?: string,
) {
  return (
    VIBE_AVATARS.find(
      (avatar) =>
        avatar.id === avatarId,
    ) ??
    VIBE_AVATARS[0]
  );
}