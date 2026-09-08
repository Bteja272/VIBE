export type IdentityType = "GUEST" | "REGISTERED";

export interface ChatMessage {
  id: string;
  roomId: string;
  presenceId: string;

  userId?: string;
  displayName?: string;
  identityType?: IdentityType;
  avatarId?: string;

  // Compatibility with older messages already stored in Redis.
  userEmail?: string;

  content: string;
  createdAt: string;
}

export interface ChatHistoryResponse {
  roomId: string;
  messages: ChatMessage[];
}
