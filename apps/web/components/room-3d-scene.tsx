"use client";

import { useRef } from "react";

import type { Group } from "three";

import { Canvas, useFrame } from "@react-three/fiber";

import { Environment, RoundedBox, Text } from "@react-three/drei";

import {
  getSeatPosition3D,
  SPATIAL_SEATS_3D,
  type SpatialParticipant,
} from "@/src/lib/spatial-layout";

interface Room3dSceneProps {
  className?: string;

  users: SpatialParticipant[];

  assignments: Record<string, string>;

  currentUserId?: string | null;

  onSeatClick?: (seatId: string) => void;

  onParticipantClick?: (userId: string) => void;

  selectedParticipantId?: string | null;

  dmUnreadCounts?: Record<string, number>;
  activeBubbles?: Record<
    string,
    {
      messageId: string;
      content: string;
    }
  >;

  onChatBubbleClick?: () => void;
}

interface Seat3dProps {
  seatId: string;

  position: [number, number, number];

  rotation: [number, number, number];

  occupied: boolean;

  canMove: boolean;

  onClick?: (seatId: string) => void;
}

interface Avatar3dProps {
  participant: SpatialParticipant;

  position: [number, number, number];

  isCurrentUser: boolean;

  selected: boolean;

  hasUnreadDm: boolean;

  onClick?: () => void;

  bubble?: string;

  onBubbleClick?: () => void;
}

interface AvatarStyle {
  body: string;

  head: string;

  accent: string;
}

function getAvatarStyle(avatarId?: string): AvatarStyle {
  switch (avatarId) {
    case "frog":
      return {
        body: "#166534",

        head: "#4ade80",

        accent: "#86efac",
      };

    case "cat":
      return {
        body: "#92400e",

        head: "#f59e0b",

        accent: "#fde68a",
      };

    case "ghost":
      return {
        body: "#64748b",

        head: "#e2e8f0",

        accent: "#f8fafc",
      };

    case "blob":
      return {
        body: "#6d28d9",

        head: "#a78bfa",

        accent: "#ddd6fe",
      };

    case "robot":
      return {
        body: "#475569",

        head: "#94a3b8",

        accent: "#67e8f9",
      };

    case "duck":
      return {
        body: "#ca8a04",

        head: "#fde047",

        accent: "#fb923c",
      };

    case "alien":
      return {
        body: "#3f6212",

        head: "#84cc16",

        accent: "#d9f99d",
      };

    case "bear":
      return {
        body: "#78350f",

        head: "#a16207",

        accent: "#d6d3d1",
      };

    default:
      return {
        body: "#404040",

        head: "#737373",

        accent: "#d4d4d4",
      };
  }
}

function Seat3d({
  seatId,

  position,

  rotation,

  occupied,

  canMove,

  onClick,
}: Seat3dProps) {
  const interactive = !occupied && canMove;

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(event) => {
        event.stopPropagation();

        if (!interactive) {
          return;
        }

        onClick?.(seatId);
      }}
      onPointerEnter={(event) => {
        if (!interactive) {
          return;
        }

        event.stopPropagation();

        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
      }}
    >
      {/* Seat base */}

      <RoundedBox
        args={[1.25, 0.25, 0.9]}
        radius={0.12}
        smoothness={4}
        position={[0, 0.35, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={occupied ? "#3f3f46" : interactive ? "#262626" : "#202020"}
        />
      </RoundedBox>

      {/* Back rest */}

      <RoundedBox
        args={[1.25, 0.95, 0.18]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.8, -0.38]}
        castShadow
      >
        <meshStandardMaterial color={occupied ? "#404040" : "#292929"} />
      </RoundedBox>

      {/* Left leg */}

      <mesh position={[-0.42, 0.12, 0]} castShadow>
        <boxGeometry args={[0.12, 0.35, 0.12]} />

        <meshStandardMaterial color="#171717" />
      </mesh>

      {/* Right leg */}

      <mesh position={[0.42, 0.12, 0]} castShadow>
        <boxGeometry args={[0.12, 0.35, 0.12]} />

        <meshStandardMaterial color="#171717" />
      </mesh>
    </group>
  );
}

function Avatar3d({
  participant,
  position,
  isCurrentUser,
  selected,
  hasUnreadDm,
  bubble,
  onClick,
  onBubbleClick,
}: Avatar3dProps) {
  const groupRef = useRef<Group>(null);

  const style = getAvatarStyle(participant.avatarId);

  /*

   * Each avatar receives a deterministic phase

   * so everyone does not bob in perfect sync.

   */

  const phase =
    participant.userId

      .split("")

      .reduce((total, character) => total + character.charCodeAt(0), 0) % 10;

  useFrame(({ clock }) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    /*

     * Very subtle idle movement.

     *

     * The base y coordinate remains stable;

     * only the visual avatar group moves.

     */

    group.position.y =
      position[1] + Math.sin(clock.elapsedTime * 1.5 + phase) * 0.025;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onPointerEnter={(event) => {
        if (!onClick) {
          return;
        }

        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
      }}
    >
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.62, 32]} />
          <meshBasicMaterial color="#f5f5f5" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Shadow */}

      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 24]} />

        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>

      {/* Torso */}

      <RoundedBox
        args={[0.62, 0.72, 0.42]}
        radius={0.16}
        smoothness={4}
        position={[0, 0.83, 0]}
        castShadow
      >
        <meshStandardMaterial color={style.body} />
      </RoundedBox>

      {/* Head */}

      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.36, 20, 20]} />

        <meshStandardMaterial color={style.head} />
      </mesh>

      {/* Left eye */}

      <mesh position={[-0.13, 1.55, 0.32]}>
        <sphereGeometry args={[0.055, 12, 12]} />

        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Right eye */}

      <mesh position={[0.13, 1.55, 0.32]}>
        <sphereGeometry args={[0.055, 12, 12]} />

        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Avatar accent */}

      <mesh position={[0, 1.38, 0.34]}>
        <sphereGeometry args={[0.055, 12, 12]} />

        <meshStandardMaterial color={style.accent} />
      </mesh>

      {/* Left arm */}

      <RoundedBox
        args={[0.18, 0.55, 0.18]}
        radius={0.08}
        smoothness={4}
        position={[-0.4, 0.84, 0]}
        rotation={[0, 0, -0.12]}
        castShadow
      >
        <meshStandardMaterial color={style.body} />
      </RoundedBox>

      {/* Right arm */}

      <RoundedBox
        args={[0.18, 0.55, 0.18]}
        radius={0.08}
        smoothness={4}
        position={[0.4, 0.84, 0]}
        rotation={[0, 0, 0.12]}
        castShadow
      >
        <meshStandardMaterial color={style.body} />
      </RoundedBox>

      {/* Left leg */}

      <RoundedBox
        args={[0.22, 0.5, 0.24]}
        radius={0.08}
        smoothness={4}
        position={[-0.18, 0.28, 0.17]}
        castShadow
      >
        <meshStandardMaterial color={style.body} />
      </RoundedBox>

      {/* Right leg */}

      <RoundedBox
        args={[0.22, 0.5, 0.24]}
        radius={0.08}
        smoothness={4}
        position={[0.18, 0.28, 0.17]}
        castShadow
      >
        <meshStandardMaterial color={style.body} />
      </RoundedBox>

      {/* Online indicator */}

      <mesh position={[0.38, 1.72, 0.15]}>
        <sphereGeometry args={[0.075, 12, 12]} />

        <meshStandardMaterial
          color="#4ade80"
          emissive="#16a34a"
          emissiveIntensity={0.7}
        />
      </mesh>

      {hasUnreadDm && !isCurrentUser && (
        <mesh position={[-0.38, 1.72, 0.15]}>
          <sphereGeometry args={[0.085, 12, 12]} />

          <meshStandardMaterial
            color="#ef4444"
            emissive="#dc2626"
            emissiveIntensity={0.85}
          />
        </mesh>
      )}

      {/* 3D nameplate */}

      {bubble && (
        <group
          position={[0, 2.85, 0]}
          onClick={(event) => {
            event.stopPropagation();
            onBubbleClick?.();
          }}
          onPointerEnter={(event) => {
            if (!onBubbleClick) {
              return;
            }

            event.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerLeave={() => {
            document.body.style.cursor = "default";
          }}
        >
          <RoundedBox args={[2.35, 0.72, 0.08]} radius={0.12} smoothness={4}>
            <meshStandardMaterial
              color="#f5f5f5"
              emissive="#262626"
              emissiveIntensity={0.08}
            />
          </RoundedBox>

          <Text
            position={[0, 0, 0.06]}
            fontSize={0.145}
            color="#171717"
            anchorX="center"
            anchorY="middle"
            maxWidth={2}
            lineHeight={1.15}
            textAlign="center"
          >
            {bubble}
          </Text>

          <mesh position={[0, -0.42, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.2, 0.2, 0.06]} />

            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
        </group>
      )}

      {bubble && !selected && (
        <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.57, 32]} />

          <meshBasicMaterial color="#d4d4d4" transparent opacity={0.7} />
        </mesh>
      )}

      <group position={[0, 2.15, 0]}>
        <Text
          fontSize={0.22}
          color="#f5f5f5"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#0a0a0a"
        >
          {participant.displayName}
        </Text>

        <Text
          position={[0, -0.28, 0]}
          fontSize={0.12}
          color={isCurrentUser ? "#d4d4d4" : "#737373"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#0a0a0a"
        >
          {isCurrentUser
            ? "YOU"
            : participant.identityType === "GUEST"
              ? "GUEST"
              : "REGISTERED"}
        </Text>
      </group>
    </group>
  );
}

function RoomEnvironment({
  users,

  assignments,

  currentUserId,

  onSeatClick,
  onParticipantClick,
  selectedParticipantId,
  dmUnreadCounts,
  activeBubbles,
  onChatBubbleClick,
}: {
  users: SpatialParticipant[];

  assignments: Record<string, string>;

  currentUserId?: string | null;

  onSeatClick?: (seatId: string) => void;

  onParticipantClick?: (userId: string) => void;

  selectedParticipantId?: string | null;

  dmUnreadCounts: Record<string, number>;

  activeBubbles: Record<
    string,
    {
      messageId: string;
      content: string;
    }
  >;

  onChatBubbleClick?: () => void;
}) {
  const occupiedSeatIds = new Set(Object.values(assignments));

  return (
    <>
      <ambientLight intensity={1.3} />

      <directionalLight position={[4, 8, 5]} intensity={2} castShadow />

      {/* Floor */}

      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[12, 0.1, 9]} />

        <meshStandardMaterial color="#171717" />
      </mesh>

      {/* Back wall */}

      <mesh position={[0, 2.5, -4.45]} receiveShadow>
        <boxGeometry args={[12, 5, 0.1]} />

        <meshStandardMaterial color="#202020" />
      </mesh>

      {/* Left wall */}

      <mesh position={[-5.95, 2.5, 0]}>
        <boxGeometry args={[0.1, 5, 9]} />

        <meshStandardMaterial color="#1c1c1c" />
      </mesh>

      {/* Right wall */}

      <mesh position={[5.95, 2.5, 0]}>
        <boxGeometry args={[0.1, 5, 9]} />

        <meshStandardMaterial color="#1c1c1c" />
      </mesh>

      {/* Rear display */}

      <RoundedBox
        args={[3.4, 1.5, 0.12]}
        radius={0.12}
        smoothness={4}
        position={[0, 2.6, -4.32]}
      >
        <meshStandardMaterial color="#111111" />
      </RoundedBox>

      {/* Center table */}

      <RoundedBox
        args={[2.7, 0.28, 1.1]}
        radius={0.15}
        smoothness={4}
        position={[0, 0.25, 1]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#292929" />
      </RoundedBox>

      {/* Physical seats */}

      {SPATIAL_SEATS_3D.map((seat) => (
        <Seat3d
          key={seat.id}
          seatId={seat.id}
          position={seat.position}
          rotation={seat.rotation}
          occupied={occupiedSeatIds.has(seat.id)}
          canMove={Boolean(currentUserId)}
          onClick={onSeatClick}
        />
      ))}

      {/* Active participants */}

      {users.map((participant) => {
        const seatId = assignments[participant.userId];

        if (!seatId) {
          return null;
        }

        const seat = getSeatPosition3D(seatId);

        if (!seat) {
          return null;
        }

        /*

         * Raise the avatar slightly above

         * the physical seat base.

         */

        const avatarPosition: [number, number, number] = [
          seat.position[0],

          seat.position[1] + 0.3,

          seat.position[2],
        ];

        return (
          <Avatar3d
            key={participant.userId}
            participant={participant}
            position={avatarPosition}
            isCurrentUser={participant.userId === currentUserId}
            selected={selectedParticipantId === participant.userId}
            hasUnreadDm={(dmUnreadCounts[participant.userId] ?? 0) > 0}
            bubble={activeBubbles[participant.userId]?.content}
            onClick={
              onParticipantClick
                ? () => onParticipantClick(participant.userId)
                : undefined
            }
            onBubbleClick={onChatBubbleClick}
          />
        );
      })}
    </>
  );
}

export default function Room3dScene({
  className,
  users,
  assignments,
  currentUserId = null,
  onSeatClick,
  onParticipantClick,
  selectedParticipantId = null,
  dmUnreadCounts = {},
  activeBubbles = {},
  onChatBubbleClick,
}: Room3dSceneProps) {
  return (
    <div
      className={className ?? "h-full min-h-[520px] w-full sm:min-h-[620px]"}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [0, 7.2, 10.5],

          fov: 44,
        }}
        gl={{
          antialias: true,
        }}
      >
        <color attach="background" args={["#0a0a0a"]} />

        <RoomEnvironment
          users={users}
          assignments={assignments}
          currentUserId={currentUserId}
          onSeatClick={onSeatClick}
          onParticipantClick={onParticipantClick}
          selectedParticipantId={selectedParticipantId}
          dmUnreadCounts={dmUnreadCounts}
          activeBubbles={activeBubbles}
          onChatBubbleClick={onChatBubbleClick}
        />

        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
