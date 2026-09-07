const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

const GUEST_SESSION_KEY =
  "vibe_guest_session";

const GUEST_ACTIVE_ROOM_KEY =
  "vibe_guest_active_room";

export interface GuestSession {
  token: string;

  expiresAt: number;

  user: {
    id: string;
    displayName: string;
    type: "GUEST";
  };
}

export function getGuestSession():
  | GuestSession
  | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const stored =
    window.sessionStorage.getItem(
      GUEST_SESSION_KEY,
    );

  if (!stored) {
    return null;
  }

  try {
    const session =
      JSON.parse(
        stored,
      ) as GuestSession;

    if (
      !session.token ||
      !session.user ||
      session.expiresAt <=
        Date.now()
    ) {
      clearGuestSession();

      return null;
    }

    return session;
  } catch {
    clearGuestSession();

    return null;
  }
}

export function clearGuestSession() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.sessionStorage.removeItem(
    GUEST_SESSION_KEY,
  );

  window.sessionStorage.removeItem(
    GUEST_ACTIVE_ROOM_KEY,
  );
}

export function setGuestActiveRoom(
  roomId: string,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.sessionStorage.setItem(
    GUEST_ACTIVE_ROOM_KEY,
    roomId,
  );
}

export function getGuestActiveRoom():
  | string
  | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return window.sessionStorage.getItem(
    GUEST_ACTIVE_ROOM_KEY,
  );
}

export function clearGuestActiveRoom() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.sessionStorage.removeItem(
    GUEST_ACTIVE_ROOM_KEY,
  );
}

export async function createGuestSession(
  displayName: string,
): Promise<GuestSession> {
  const normalizedName =
    displayName.trim();

  const response =
    await fetch(
      `${API_URL}/auth/guest`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            displayName:
              normalizedName,
          }),
      },
    );

  const body =
    await response
      .json()
      .catch(
        () => null,
      );

  if (!response.ok) {
    const message =
      Array.isArray(
        body?.message,
      )
        ? body.message.join(
            ", ",
          )
        : body?.message;

    throw new Error(
      message ??
        "Unable to create guest session",
    );
  }

  const session:
    GuestSession = {
      token:
        body.token,

      expiresAt:
        Date.now() +
        body.expiresIn *
          1000,

      user: {
        id:
          body.user.id,

        displayName:
          body.user.displayName,

        type:
          "GUEST",
      },
    };

  window.sessionStorage.setItem(
    GUEST_SESSION_KEY,
    JSON.stringify(
      session,
    ),
  );

  return session;
}