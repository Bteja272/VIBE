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

  /*
   * Normalized percentage coordinates.
   *
   * 0 = left/top
   * 100 = right/bottom
   */
  x: number;
  y: number;
}

export interface SpatialSeat<
  T extends SpatialParticipant,
> {
  participant: T;
  position: SeatPosition;
  index: number;
}

/*
 * The visual canvas currently supports
 * a maximum of 12 active participants,
 * matching backend room capacity.
 */
const LAYOUTS: Record<
  number,
  SeatPosition[]
> = {
  1: [
    {
      id: "center",
      x: 50,
      y: 52,
    },
  ],

  2: [
    {
      id: "left",
      x: 35,
      y: 52,
    },
    {
      id: "right",
      x: 65,
      y: 52,
    },
  ],

  3: [
    {
      id: "top-left",
      x: 35,
      y: 38,
    },
    {
      id: "top-right",
      x: 65,
      y: 38,
    },
    {
      id: "bottom-center",
      x: 50,
      y: 68,
    },
  ],

  4: [
    {
      id: "top-left",
      x: 35,
      y: 36,
    },
    {
      id: "top-right",
      x: 65,
      y: 36,
    },
    {
      id: "bottom-left",
      x: 35,
      y: 68,
    },
    {
      id: "bottom-right",
      x: 65,
      y: 68,
    },
  ],

  5: [
    {
      id: "top-left",
      x: 28,
      y: 36,
    },
    {
      id: "top-center",
      x: 50,
      y: 36,
    },
    {
      id: "top-right",
      x: 72,
      y: 36,
    },
    {
      id: "bottom-left",
      x: 39,
      y: 68,
    },
    {
      id: "bottom-right",
      x: 61,
      y: 68,
    },
  ],

  6: [
    {
      id: "top-left",
      x: 27,
      y: 36,
    },
    {
      id: "top-center",
      x: 50,
      y: 36,
    },
    {
      id: "top-right",
      x: 73,
      y: 36,
    },
    {
      id: "bottom-left",
      x: 27,
      y: 68,
    },
    {
      id: "bottom-center",
      x: 50,
      y: 68,
    },
    {
      id: "bottom-right",
      x: 73,
      y: 68,
    },
  ],

  7: [
    {
      id: "row-1-1",
      x: 20,
      y: 36,
    },
    {
      id: "row-1-2",
      x: 40,
      y: 36,
    },
    {
      id: "row-1-3",
      x: 60,
      y: 36,
    },
    {
      id: "row-1-4",
      x: 80,
      y: 36,
    },
    {
      id: "row-2-1",
      x: 30,
      y: 68,
    },
    {
      id: "row-2-2",
      x: 50,
      y: 68,
    },
    {
      id: "row-2-3",
      x: 70,
      y: 68,
    },
  ],

  8: [
    {
      id: "row-1-1",
      x: 20,
      y: 36,
    },
    {
      id: "row-1-2",
      x: 40,
      y: 36,
    },
    {
      id: "row-1-3",
      x: 60,
      y: 36,
    },
    {
      id: "row-1-4",
      x: 80,
      y: 36,
    },
    {
      id: "row-2-1",
      x: 20,
      y: 68,
    },
    {
      id: "row-2-2",
      x: 40,
      y: 68,
    },
    {
      id: "row-2-3",
      x: 60,
      y: 68,
    },
    {
      id: "row-2-4",
      x: 80,
      y: 68,
    },
  ],

  9: [
    {
      id: "row-1-1",
      x: 28,
      y: 28,
    },
    {
      id: "row-1-2",
      x: 50,
      y: 28,
    },
    {
      id: "row-1-3",
      x: 72,
      y: 28,
    },
    {
      id: "row-2-1",
      x: 28,
      y: 52,
    },
    {
      id: "row-2-2",
      x: 50,
      y: 52,
    },
    {
      id: "row-2-3",
      x: 72,
      y: 52,
    },
    {
      id: "row-3-1",
      x: 28,
      y: 76,
    },
    {
      id: "row-3-2",
      x: 50,
      y: 76,
    },
    {
      id: "row-3-3",
      x: 72,
      y: 76,
    },
  ],

  10: [
    {
      id: "row-1-1",
      x: 20,
      y: 27,
    },
    {
      id: "row-1-2",
      x: 40,
      y: 27,
    },
    {
      id: "row-1-3",
      x: 60,
      y: 27,
    },
    {
      id: "row-1-4",
      x: 80,
      y: 27,
    },
    {
      id: "row-2-1",
      x: 20,
      y: 52,
    },
    {
      id: "row-2-2",
      x: 40,
      y: 52,
    },
    {
      id: "row-2-3",
      x: 60,
      y: 52,
    },
    {
      id: "row-2-4",
      x: 80,
      y: 52,
    },
    {
      id: "row-3-1",
      x: 40,
      y: 77,
    },
    {
      id: "row-3-2",
      x: 60,
      y: 77,
    },
  ],

  11: [
    {
      id: "row-1-1",
      x: 20,
      y: 27,
    },
    {
      id: "row-1-2",
      x: 40,
      y: 27,
    },
    {
      id: "row-1-3",
      x: 60,
      y: 27,
    },
    {
      id: "row-1-4",
      x: 80,
      y: 27,
    },
    {
      id: "row-2-1",
      x: 20,
      y: 52,
    },
    {
      id: "row-2-2",
      x: 40,
      y: 52,
    },
    {
      id: "row-2-3",
      x: 60,
      y: 52,
    },
    {
      id: "row-2-4",
      x: 80,
      y: 52,
    },
    {
      id: "row-3-1",
      x: 30,
      y: 77,
    },
    {
      id: "row-3-2",
      x: 50,
      y: 77,
    },
    {
      id: "row-3-3",
      x: 70,
      y: 77,
    },
  ],

  12: [
    {
      id: "row-1-1",
      x: 20,
      y: 27,
    },
    {
      id: "row-1-2",
      x: 40,
      y: 27,
    },
    {
      id: "row-1-3",
      x: 60,
      y: 27,
    },
    {
      id: "row-1-4",
      x: 80,
      y: 27,
    },
    {
      id: "row-2-1",
      x: 20,
      y: 52,
    },
    {
      id: "row-2-2",
      x: 40,
      y: 52,
    },
    {
      id: "row-2-3",
      x: 60,
      y: 52,
    },
    {
      id: "row-2-4",
      x: 80,
      y: 52,
    },
    {
      id: "row-3-1",
      x: 20,
      y: 77,
    },
    {
      id: "row-3-2",
      x: 40,
      y: 77,
    },
    {
      id: "row-3-3",
      x: 60,
      y: 77,
    },
    {
      id: "row-3-4",
      x: 80,
      y: 77,
    },
  ],
};

export function getSpatialLayout(
  participantCount: number,
): SeatPosition[] {
  if (
    participantCount <=
    0
  ) {
    return [];
  }

  const safeCount =
    Math.min(
      participantCount,
      12,
    );

  return (
    LAYOUTS[
      safeCount
    ] ?? []
  );
}

export function assignParticipantsToSeats<
  T extends SpatialParticipant,
>(
  participants: T[],
): SpatialSeat<T>[] {
  /*
   * Stable deterministic ordering.
   *
   * Socket/Redis ordering should not
   * decide where somebody sits.
   */
  const ordered =
    [...participants].sort(
      (
        left,
        right,
      ) =>
        left.userId.localeCompare(
          right.userId,
        ),
    );

  const positions =
    getSpatialLayout(
      ordered.length,
    );

  return ordered.map(
    (
      participant,
      index,
    ) => ({
      participant,

      position:
        positions[index],

      index,
    }),
  );
}