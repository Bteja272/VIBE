export interface SpatialParticipant {
  userId: string;
  presenceId: string;
  displayName: string;

  identityType:
    | "GUEST"
    | "REGISTERED";

  avatarId?: string;
}

export interface SeatPosition {
  id: string;
  x: number;
  y: number;
}

export interface SeatAssignment {
  userId: string;
  seatId: string;
}

export interface SpatialSeat<
  T extends SpatialParticipant,
> {
  participant: T;
  position: SeatPosition;
  seatId: string;
}

/*
 * Fixed 12-seat room.
 *
 * Positions never change when occupancy
 * changes. This is what gives participants
 * spatial stability.
 */
export const SPATIAL_SEATS:
  SeatPosition[] = [
  {
    id: "seat-1",
    x: 40,
    y: 42,
  },
  {
    id: "seat-2",
    x: 60,
    y: 42,
  },

  {
    id: "seat-3",
    x: 40,
    y: 68,
  },
  {
    id: "seat-4",
    x: 60,
    y: 68,
  },

  {
    id: "seat-5",
    x: 22,
    y: 42,
  },
  {
    id: "seat-6",
    x: 78,
    y: 42,
  },

  {
    id: "seat-7",
    x: 22,
    y: 68,
  },
  {
    id: "seat-8",
    x: 78,
    y: 68,
  },

  {
    id: "seat-9",
    x: 22,
    y: 24,
  },
  {
    id: "seat-10",
    x: 40,
    y: 24,
  },
  {
    id: "seat-11",
    x: 60,
    y: 24,
  },
  {
    id: "seat-12",
    x: 78,
    y: 24,
  },
];

/*
 * Determines which seats newcomers receive.
 *
 * Central seats fill first so small groups
 * still look intentional.
 */
export const SEAT_PRIORITY = [
  "seat-1",
  "seat-2",
  "seat-3",
  "seat-4",

  "seat-5",
  "seat-6",
  "seat-7",
  "seat-8",

  "seat-9",
  "seat-10",
  "seat-11",
  "seat-12",
];

export function getSeatPosition(
  seatId: string,
): SeatPosition | undefined {
  return SPATIAL_SEATS.find(
    (seat) =>
      seat.id === seatId,
  );
}

export function reconcileSeatAssignments(
  participants:
    SpatialParticipant[],
  previous:
    Record<string, string>,
): Record<string, string> {
  const activeUserIds =
    new Set(
      participants.map(
        (participant) =>
          participant.userId,
      ),
    );

  const next:
    Record<string, string> =
      {};

  const occupiedSeats =
    new Set<string>();

  /*
   * Preserve valid existing assignments
   * for participants who are still here.
   */
  for (
    const [
      userId,
      seatId,
    ] of Object.entries(
      previous,
    )
  ) {
    if (
      !activeUserIds.has(
        userId,
      )
    ) {
      continue;
    }

    if (
      !getSeatPosition(
        seatId,
      )
    ) {
      continue;
    }

    if (
      occupiedSeats.has(
        seatId,
      )
    ) {
      continue;
    }

    next[userId] =
      seatId;

    occupiedSeats.add(
      seatId,
    );
  }

  /*
   * Deterministic ordering prevents
   * Redis response order from affecting
   * seat assignment.
   */
  const unassigned =
    participants
      .filter(
        (participant) =>
          !next[
            participant.userId
          ],
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.userId.localeCompare(
            right.userId,
          ),
      );

  for (
    const participant of
      unassigned
  ) {
    const availableSeat =
      SEAT_PRIORITY.find(
        (seatId) =>
          !occupiedSeats.has(
            seatId,
          ),
      );

    if (
      !availableSeat
    ) {
      break;
    }

    next[
      participant.userId
    ] =
      availableSeat;

    occupiedSeats.add(
      availableSeat,
    );
  }

  return next;
}

export function buildSpatialSeats<
  T extends SpatialParticipant,
>(
  participants: T[],
  assignments:
    Record<string, string>,
): SpatialSeat<T>[] {
  return participants
    .map(
      (participant) => {
        const seatId =
          assignments[
            participant.userId
          ];

        if (!seatId) {
          return null;
        }

        const position =
          getSeatPosition(
            seatId,
          );

        if (!position) {
          return null;
        }

        return {
          participant,
          seatId,
          position,
        };
      },
    )
    .filter(
      (
        seat,
      ): seat is SpatialSeat<T> =>
        seat !== null,
    );
}