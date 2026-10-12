export interface SpatialParticipant {
  userId: string;
  presenceId: string;
  displayName: string;
  identityType: "GUEST" | "REGISTERED";
  avatarId?: string;
  seatId?: string;
}

export interface SeatPosition {
  id: string;
  x: number;
  y: number;
}

export interface SpatialSeat<T extends SpatialParticipant> {
  participant: T;
  position: SeatPosition;
  seatId: string;
}

/*
 * Fixed positions keep participants spatially stable.
 * The logical seat IDs are shared by both the 2D and 3D renderers.
 */
export const SPATIAL_SEATS: SeatPosition[] = [
  { id: "seat-1", x: 40, y: 42 },
  { id: "seat-2", x: 60, y: 42 },
  { id: "seat-3", x: 40, y: 68 },
  { id: "seat-4", x: 60, y: 68 },

  { id: "seat-5", x: 22, y: 42 },
  { id: "seat-6", x: 78, y: 42 },
  { id: "seat-7", x: 22, y: 68 },
  { id: "seat-8", x: 78, y: 68 },

  { id: "seat-9", x: 22, y: 24 },
  { id: "seat-10", x: 40, y: 24 },
  { id: "seat-11", x: 60, y: 24 },
  { id: "seat-12", x: 78, y: 24 },
];

export interface SeatPosition3D {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

export const SPATIAL_SEATS_3D: SeatPosition3D[] = [
  // Back row
  {
    id: "seat-9",
    position: [-4.2, 0.35, -2.7],
    rotation: [0, 0, 0],
  },
  {
    id: "seat-10",
    position: [-1.4, 0.35, -2.7],
    rotation: [0, 0, 0],
  },
  {
    id: "seat-11",
    position: [1.4, 0.35, -2.7],
    rotation: [0, 0, 0],
  },
  {
    id: "seat-12",
    position: [4.2, 0.35, -2.7],
    rotation: [0, 0, 0],
  },

  // Middle row
  {
    id: "seat-5",
    position: [-4.2, 0.35, -0.2],
    rotation: [0, 0, 0],
  },
  {
    id: "seat-1",
    position: [-1.4, 0.35, -0.2],
    rotation: [0, 0, 0],
  },
  {
    id: "seat-2",
    position: [1.4, 0.35, -0.2],
    rotation: [0, 0, 0],
  },
  {
    id: "seat-6",
    position: [4.2, 0.35, -0.2],
    rotation: [0, 0, 0],
  },

  // Front row
  {
    id: "seat-7",
    position: [-4.2, 0.35, 2.5],
    rotation: [0, Math.PI, 0],
  },
  {
    id: "seat-3",
    position: [-1.4, 0.35, 2.5],
    rotation: [0, Math.PI, 0],
  },
  {
    id: "seat-4",
    position: [1.4, 0.35, 2.5],
    rotation: [0, Math.PI, 0],
  },
  {
    id: "seat-8",
    position: [4.2, 0.35, 2.5],
    rotation: [0, Math.PI, 0],
  },
];

export function getSeatPosition3D(seatId: string): SeatPosition3D | undefined {
  return SPATIAL_SEATS_3D.find((seat) => seat.id === seatId);
}

export function getSeatPosition(seatId: string): SeatPosition | undefined {
  return SPATIAL_SEATS.find((seat) => seat.id === seatId);
}

export function buildSpatialSeats<T extends SpatialParticipant>(
  participants: T[],
  assignments: Record<string, string>,
): SpatialSeat<T>[] {
  return participants
    .map((participant) => {
      const seatId = assignments[participant.userId];

      if (!seatId) {
        return null;
      }

      const position = getSeatPosition(seatId);

      if (!position) {
        return null;
      }

      return {
        participant,
        position,
        seatId,
      };
    })
    .filter((seat): seat is SpatialSeat<T> => seat !== null);
}
