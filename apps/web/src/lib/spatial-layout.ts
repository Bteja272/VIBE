export interface SpatialParticipant {
  userId: string;
  presenceId: string;
  displayName: string;
  identityType: "GUEST" | "REGISTERED";
  avatarId?: string;
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
 * Fixed positions keep participants spatially stable as
 * room occupancy changes.
 *
 * Array order is also the assignment priority:
 * central seats fill before outer seats.
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

export const SEAT_PRIORITY = SPATIAL_SEATS.map((seat) => seat.id);

export function getSeatPosition(seatId: string): SeatPosition | undefined {
  return SPATIAL_SEATS.find((seat) => seat.id === seatId);
}

export function reconcileSeatAssignments(
  participants: SpatialParticipant[],
  previous: Record<string, string>,
): Record<string, string> {
  const activeUserIds = new Set(
    participants.map((participant) => participant.userId),
  );

  const next: Record<string, string> = {};
  const occupiedSeats = new Set<string>();

  // Keep valid assignments for participants who are still present.
  for (const [userId, seatId] of Object.entries(previous)) {
    if (!activeUserIds.has(userId)) {
      continue;
    }

    if (!getSeatPosition(seatId) || occupiedSeats.has(seatId)) {
      continue;
    }

    next[userId] = seatId;
    occupiedSeats.add(seatId);
  }

  /*
   * Stable sorting prevents Redis response order from changing
   * the seats assigned to newly arrived participants.
   */
  const unassigned = participants
    .filter((participant) => !next[participant.userId])
    .sort((left, right) => left.userId.localeCompare(right.userId));

  for (const participant of unassigned) {
    const availableSeat = SEAT_PRIORITY.find(
      (seatId) => !occupiedSeats.has(seatId),
    );

    if (!availableSeat) {
      break;
    }

    next[participant.userId] = availableSeat;
    occupiedSeats.add(availableSeat);
  }

  return next;
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
