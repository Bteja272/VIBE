export type RoomVisibility = "PUBLIC" | "PRIVATE";
export type RoomRole = "OWNER" | "MEMBER";

export interface RoomUser {
  id: string;
  email: string;
  displayName: string | null;
  imageUrl: string | null;
}

export interface RoomMembership {
  id: string;
  userId: string;
  roomId: string;
  role: RoomRole;
  joinedAt: string;
  user: RoomUser;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: RoomVisibility;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: RoomUser;
  memberships: RoomMembership[];
}