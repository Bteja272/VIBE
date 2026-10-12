"use client";

import { Canvas } from "@react-three/fiber";
import {
  Environment,
  RoundedBox,
} from "@react-three/drei";

import {
  SPATIAL_SEATS_3D,
} from "@/src/lib/spatial-layout";

interface Room3dSceneProps {
  className?: string;

  assignments: Record<string, string>;
  currentUserId?: string | null;

  onSeatClick?: (seatId: string) => void;
}

interface Seat3dProps {
  seatId: string;
  position: [number, number, number];
  rotation: [number, number, number];

  occupied: boolean;
  canMove: boolean;

  onClick?: (seatId: string) => void;
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
    >
      {/* Seat */}
      <RoundedBox
        args={[1.25, 0.25, 0.9]}
        radius={0.12}
        smoothness={4}
        position={[0, 0.35, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={
            occupied
              ? "#3f3f46"
              : interactive
                ? "#262626"
                : "#202020"
          }
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
        <meshStandardMaterial
          color={occupied ? "#404040" : "#292929"}
        />
      </RoundedBox>

      {/* Left leg */}
      <mesh position={[-0.42, 0.12, 0]}>
        <boxGeometry args={[0.12, 0.35, 0.12]} />
        <meshStandardMaterial color="#171717" />
      </mesh>

      {/* Right leg */}
      <mesh position={[0.42, 0.12, 0]}>
        <boxGeometry args={[0.12, 0.35, 0.12]} />
        <meshStandardMaterial color="#171717" />
      </mesh>
    </group>
  );
}

function RoomEnvironment({
  assignments,
  currentUserId,
  onSeatClick,
}: {
  assignments: Record<string, string>;
  currentUserId?: string | null;
  onSeatClick?: (seatId: string) => void;
}) {
  const occupiedSeatIds = new Set(
    Object.values(assignments),
  );

  return (
    <>
      <ambientLight intensity={1.3} />

      <directionalLight
        position={[4, 8, 5]}
        intensity={2}
        castShadow
      />

      {/* Floor */}
      <mesh
        position={[0, -0.05, 0]}
        receiveShadow
      >
        <boxGeometry args={[12, 0.1, 9]} />
        <meshStandardMaterial color="#171717" />
      </mesh>

      {/* Back wall */}
      <mesh
        position={[0, 2.5, -4.45]}
        receiveShadow
      >
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

      {/* Smaller center table */}
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
    </>
  );
}

export default function Room3dScene({
  className,
  assignments,
  currentUserId = null,
  onSeatClick,
}: Room3dSceneProps) {
  return (
    <div
      className={
        className ??
        "h-full min-h-[520px] w-full sm:min-h-[620px]"
      }
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
        <color
          attach="background"
          args={["#0a0a0a"]}
        />

        <RoomEnvironment
          assignments={assignments}
          currentUserId={currentUserId}
          onSeatClick={onSeatClick}
        />

        <Environment preset="city" />
      </Canvas>
    </div>
  );
}