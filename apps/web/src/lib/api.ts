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