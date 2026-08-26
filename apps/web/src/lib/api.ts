import type { Room } from "@/types/room";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getRooms(): Promise<Room[]> {
  const response = await fetch(`${API_URL}/rooms`, {
    cache: "no-store",
  });

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
    `${API_URL}/rooms/slug/${encodeURIComponent(slug)}`,
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

export async function joinRoom(
  roomId: string,
  email: string,
) {
  const response = await fetch(
    `${API_URL}/rooms/${roomId}/join`,
    {
      method: "POST",
      headers: {
        "x-dev-user-email": email,
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new Error(
      body?.message ?? `Failed to join room: ${response.status}`,
    );
  }

  return response.json();
}

export async function leaveRoom(
  roomId: string,
  email: string,
) {
  const response = await fetch(
    `${API_URL}/rooms/${roomId}/leave`,
    {
      method: "DELETE",
      headers: {
        "x-dev-user-email": email,
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new Error(
      body?.message ?? `Failed to leave room: ${response.status}`,
    );
  }

  return response.json();
}