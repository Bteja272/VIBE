const PRESENCE_ID_KEY =
  "vibe_presence_id";

export function getPresenceId(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "getPresenceId must only be called in the browser",
    );
  }

  const existing =
    window.sessionStorage.getItem(
      PRESENCE_ID_KEY,
    );

  if (existing) {
    return existing;
  }

  const presenceId =
    crypto.randomUUID();

  window.sessionStorage.setItem(
    PRESENCE_ID_KEY,
    presenceId,
  );

  return presenceId;
}