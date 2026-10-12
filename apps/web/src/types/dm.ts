export interface DirectMessage {
  id: string;
  roomId: string;

  senderUserId: string;
  senderDisplayName: string;
  senderIdentityType: "GUEST" | "REGISTERED";
  senderAvatarId?: string;

  recipientUserId: string;

  content: string;
  createdAt: string;
}

export interface DmSendResponse {
  sent: boolean;
  error?: string;
  message?: DirectMessage;
}