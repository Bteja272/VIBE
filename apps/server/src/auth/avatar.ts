export const VIBE_AVATAR_IDS = [
  'frog',
  'cat',
  'ghost',
  'blob',
  'robot',
  'duck',
  'alien',
  'bear',
] as const;

export type VibeAvatarId =
  (typeof VIBE_AVATAR_IDS)[number];

export function isVibeAvatarId(
  value: string,
): value is VibeAvatarId {
  return (
    VIBE_AVATAR_IDS as readonly string[]
  ).includes(value);
}