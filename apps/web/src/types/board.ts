export type BoardMediaType = "IMAGE" | "YOUTUBE";

export interface RoomBoardState {
  roomId: string;
  revision: number;
  media: {
    type: BoardMediaType;
    url: string;
    title?: string;
    videoId?: string;
    updatedBy: string;
  } | null;
  updatedAt: string;
}