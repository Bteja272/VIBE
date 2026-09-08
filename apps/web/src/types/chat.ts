export interface ChatMessage {
  id: string;
  roomId: string;
  presenceId: string;

  userId?: string;

  displayName?: string;

  identityType?:
    | "GUEST"
    | "REGISTERED";

  avatarId?: string;

  /*
   * Transitional compatibility for
   * older Redis messages.
   */
  userEmail?: string;

  content: string;
  createdAt: string;
}

export interface ChatHistoryResponse {
  roomId: string;

  messages: ChatMessage[];
}