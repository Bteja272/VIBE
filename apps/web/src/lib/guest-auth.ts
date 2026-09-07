const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

const GUEST_SESSION_KEY =
  "vibe_guest_session";

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
      session.expiresAt <=
      Date.now()
    ) {
      window.sessionStorage.removeItem(
        GUEST_SESSION_KEY,
      );

      return null;
    }

    return session;
  } catch {
    window.sessionStorage.removeItem(
      GUEST_SESSION_KEY,
    );

    return null;
  }
}

export async function createGuestSession(
  displayName: string,
): Promise<GuestSession> {
  const response =
    await fetch(
      `${API_URL}/auth/guest`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            displayName:
              displayName.trim(),
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