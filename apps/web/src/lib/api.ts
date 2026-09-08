import type { Room } from "@/types/room";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export interface VibeTokenResponse {
  token: string;

  expiresIn: number;

  profileCompleted: boolean;

  user: {
    id: string;
    displayName: string;

    type:
      | "GUEST"
      | "REGISTERED";

    email?: string;
    imageUrl?: string;
    avatarId?: string;
  };
}

export async function getRooms(): Promise<Room[]> {
  const response = await fetch(
    `${API_URL}/rooms`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load rooms: ${response.status}`,
    );
  }

  return response.json();
}

export async function getRoomBySlug(
  slug: string,
): Promise<Room | null> {
  const response = await fetch(
    `${API_URL}/rooms/slug/${encodeURIComponent(
      slug,
    )}`,
    {
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load room: ${response.status}`,
    );
  }

  return response.json();
}

export async function getVibeToken(): Promise<VibeTokenResponse> {
  const response = await fetch(
    "/api/auth/vibe-token",
    {
      cache: "no-store",
    },
  );

  const body = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.message ??
        "You must sign in first",
    );
  }

  if (!body?.token) {
    throw new Error(
      "Authentication token was not returned",
    );
  }

  return body as VibeTokenResponse;
}

export async function createRoom(
  input: {
    name: string;
    description?: string;
    visibility:
      | "PUBLIC"
      | "PRIVATE";
  },
  token: string,
) {
  const response = await fetch(
    `${API_URL}/rooms`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body:
        JSON.stringify(
          input,
        ),
    },
  );

  return readApiResponse(
    response,
    "Failed to create room",
  );
}

export async function joinRoom(
  roomId: string,
  token: string,
) {
  const response = await fetch(
    `${API_URL}/rooms/${roomId}/join`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );

  return readApiResponse(
    response,
    "Failed to join room",
  );
}

export async function leaveRoom(
  roomId: string,
  token: string,
) {
  const response = await fetch(
    `${API_URL}/rooms/${roomId}/leave`,
    {
      method: "DELETE",

      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );

  return readApiResponse(
    response,
    "Failed to leave room",
  );
}

export async function updateRoom(
  roomId: string,

  input: {
    name: string;
    description?: string;
    visibility:
      | "PUBLIC"
      | "PRIVATE";
  },

  token: string,
) {
  const response = await fetch(
    `${API_URL}/rooms/${roomId}`,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body:
        JSON.stringify(
          input,
        ),
    },
  );

  return readApiResponse(
    response,
    "Failed to update room",
  );
}

export async function updateVibeProfile(
  displayName: string,
  token: string,
): Promise<VibeTokenResponse> {
  const response = await fetch(
    `${API_URL}/auth/profile`,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body:
        JSON.stringify({
          displayName:
            displayName.trim(),
        }),
    },
  );

  const body = await response
    .json()
    .catch(() => null);

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
        "Unable to update profile",
    );
  }

  return body as VibeTokenResponse;
}

export async function updateVibeAvatar(
  avatarId: string,
  token: string,
): Promise<VibeTokenResponse> {
  const response = await fetch(
    `${API_URL}/auth/avatar`,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body:
        JSON.stringify({
          avatarId,
        }),
    },
  );

  const body = await response
    .json()
    .catch(() => null);

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
        "Unable to update avatar",
    );
  }

  return body as VibeTokenResponse;
}

export async function deleteRoom(
  roomId: string,
  token: string,
) {
  const response = await fetch(
    `${API_URL}/rooms/${roomId}`,
    {
      method: "DELETE",

      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );

  return readApiResponse(
    response,
    "Failed to delete room",
  );
}

async function readApiResponse(
  response: Response,
  fallback: string,
) {
  const body = await response
    .json()
    .catch(() => null);

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
        `${fallback}: ${response.status}`,
    );
  }

  return body;
}