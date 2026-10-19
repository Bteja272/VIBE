import type { SpatialParticipant } from "@/src/lib/spatial-layout";

export interface Room3dActiveBubble {
  messageId: string;
  content: string;
}

export interface Room3dEnvironmentProps {
  users: SpatialParticipant[];
  assignments: Record<string, string>;
  currentUserId?: string | null;
  onSeatClick?: (seatId: string) => void;
  onParticipantClick?: (userId: string) => void;
  selectedParticipantId?: string | null;
  dmUnreadCounts: Record<string, number>;
  activeBubbles: Record<string, Room3dActiveBubble>;
  onChatBubbleClick?: () => void;
}

export interface Room3dBoardSurfaceDefinition {
  topLeft: [number, number, number];
  bottomRight: [number, number, number];
}

export interface Room3dCameraDefinition {
  position: [number, number, number];
  fov: number;
  responsiveReferenceAspect: number;
  maxResponsiveFov: number;
}
