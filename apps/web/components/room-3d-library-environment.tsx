"use client";

import { RoundedBox } from "@react-three/drei";

import Room3dOccupants from "@/components/room-3d-occupants";
import type { Room3dEnvironmentProps } from "@/components/room-3d-environment-types";
import { LIBRARY_SPATIAL_SEATS_3D } from "@/src/lib/spatial-layout";

const SHELF_ROWS = [0.55, 1.35, 2.15, 2.95];

const BOOK_COLORS = [
  "#7f1d1d",
  "#1e3a5f",
  "#365314",
  "#78350f",
  "#4c1d95",
  "#374151",
];

function Bookcase({
  position,
  rotationY = 0,
  width = 2.5,
}: {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[width, 3.7, 0.48]}
        radius={0.08}
        smoothness={3}
        position={[0, 1.85, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#241811" roughness={0.92} />
      </RoundedBox>

      {/* Crown trim */}
      <RoundedBox
        args={[width + 0.14, 0.12, 0.58]}
        radius={0.04}
        smoothness={2}
        position={[0, 3.72, 0.02]}
        castShadow
      >
        <meshStandardMaterial color="#5a3a24" roughness={0.84} />
      </RoundedBox>

      {/* Side uprights */}
      <mesh position={[-width / 2 + 0.08, 1.85, 0.27]} castShadow>
        <boxGeometry args={[0.12, 3.48, 0.52]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.88} />
      </mesh>

      <mesh position={[width / 2 - 0.08, 1.85, 0.27]} castShadow>
        <boxGeometry args={[0.12, 3.48, 0.52]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.88} />
      </mesh>

      {SHELF_ROWS.map((y, rowIndex) => (
        <group key={y}>
          <mesh position={[0, y, 0.29]} castShadow>
            <boxGeometry args={[width - 0.18, 0.08, 0.54]} />
            <meshStandardMaterial color="#5a3a24" roughness={0.9} />
          </mesh>

          {Array.from({ length: 9 }, (_, bookIndex) => {
            const usableWidth = width - 0.46;
            const x = -usableWidth / 2 + (bookIndex / 8) * usableWidth;

            const height =
              0.31 + ((bookIndex + rowIndex * 2) % 4) * 0.055;

            const depth = 0.17 + ((bookIndex + rowIndex) % 2) * 0.025;

            const color =
              BOOK_COLORS[(bookIndex + rowIndex * 2) % BOOK_COLORS.length];

            const tilt =
              bookIndex % 5 === 0
                ? 0.08
                : bookIndex % 7 === 0
                  ? -0.07
                  : 0;

            return (
              <mesh
                key={`${rowIndex}-${bookIndex}`}
                position={[x, y + 0.18, 0.57]}
                rotation={[0, 0, tilt]}
                castShadow
              >
                <boxGeometry args={[0.16, height, depth]} />
                <meshStandardMaterial color={color} roughness={0.86} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Lower cabinet lip */}
      <RoundedBox
        args={[width - 0.12, 0.16, 0.56]}
        radius={0.04}
        smoothness={2}
        position={[0, 0.13, 0.02]}
      >
        <meshStandardMaterial color="#4a2f20" roughness={0.9} />
      </RoundedBox>
    </group>
  );
}

function TableLamp() {
  return (
    <group position={[0, 1.02, 0]}>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.16, 0.19, 0.08, 16]} />
        <meshStandardMaterial
          color="#8c6a32"
          metalness={0.35}
          roughness={0.48}
        />
      </mesh>

      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 0.38, 12]} />
        <meshStandardMaterial
          color="#c49a4b"
          metalness={0.4}
          roughness={0.45}
        />
      </mesh>

      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.24, 0.28, 18, 1, true]} />
        <meshStandardMaterial
          color="#e3c88b"
          emissive="#b7791f"
          emissiveIntensity={0.26}
          side={2}
        />
      </mesh>

      <pointLight
        position={[0, 0.32, 0]}
        intensity={0.44}
        distance={2.7}
        decay={2}
        color="#ffd991"
      />
    </group>
  );
}

function BookStack({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[0.52, 0.07, 0.34]}
        radius={0.02}
        smoothness={2}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial color="#6b2f2f" roughness={0.84} />
      </RoundedBox>

      <RoundedBox
        args={[0.46, 0.07, 0.31]}
        radius={0.02}
        smoothness={2}
        position={[0.03, 0.08, -0.01]}
        rotation={[0, 0.12, 0]}
      >
        <meshStandardMaterial color="#334155" roughness={0.84} />
      </RoundedBox>

      <RoundedBox
        args={[0.4, 0.07, 0.29]}
        radius={0.02}
        smoothness={2}
        position={[-0.02, 0.16, 0.01]}
        rotation={[0, -0.1, 0]}
      >
        <meshStandardMaterial color="#3f6212" roughness={0.84} />
      </RoundedBox>
    </group>
  );
}

function ReadingTable({ x, accent }: { x: number; accent: string }) {
  return (
    <group position={[x, 0, 0.6]}>
      {/* Rug */}
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.55, 3.1]} />
        <meshStandardMaterial color={accent} roughness={1} />
      </mesh>

      <mesh position={[0, 0.023, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.12, 1.24, 4]} />
        <meshStandardMaterial color="#8b6d46" roughness={1} />
      </mesh>

      {/* Table top */}
      <RoundedBox
        args={[1.8, 0.18, 2.15]}
        radius={0.08}
        smoothness={3}
        position={[0, 0.72, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#4a2f20" roughness={0.82} />
      </RoundedBox>

      {/* Inset runner */}
      <RoundedBox
        args={[0.52, 0.04, 1.74]}
        radius={0.03}
        smoothness={2}
        position={[0, 0.83, 0]}
      >
        <meshStandardMaterial color="#6d5a3d" roughness={0.95} />
      </RoundedBox>

      {/* Legs */}
      {[
        [-0.68, 0.35, -0.78],
        [0.68, 0.35, -0.78],
        [-0.68, 0.35, 0.78],
        [0.68, 0.35, 0.78],
      ].map((position, index) => (
        <mesh
          key={index}
          position={position as [number, number, number]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.7, 0.12]} />
          <meshStandardMaterial color="#332218" roughness={0.9} />
        </mesh>
      ))}

      <TableLamp />

      <BookStack position={[-0.5, 0.88, -0.54]} rotationY={0.18} />
      <BookStack position={[0.5, 0.88, 0.52]} rotationY={-0.16} />
    </group>
  );
}

function WallSconce({
  position,
}: {
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[0.18, 0.34, 0.08]} />
        <meshStandardMaterial
          color="#8a6a3d"
          metalness={0.3}
          roughness={0.48}
        />
      </mesh>

      <mesh position={[0, 0.17, 0.08]}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial
          color="#f5d79d"
          emissive="#d97706"
          emissiveIntensity={0.4}
        />
      </mesh>

      <pointLight
        position={[0, 0.17, 0.18]}
        intensity={0.28}
        distance={2.6}
        decay={2}
        color="#ffd99b"
      />
    </group>
  );
}

export default function Room3dLibraryEnvironment(
  props: Room3dEnvironmentProps,
) {
  return (
    <>
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[4, 8, 5]}
        intensity={0.78}
        color="#f4e4c1"
        castShadow
      />

      {/* Floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[12, 0.1, 9]} />
        <meshStandardMaterial color="#1d1611" roughness={0.96} />
      </mesh>

      {/* Subtle plank strips */}
      {[-4.5, -3, -1.5, 0, 1.5, 3, 4.5].map((x) => (
        <mesh
          key={x}
          position={[x, 0.006, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.025, 8.8]} />
          <meshBasicMaterial color="#3a2a20" transparent opacity={0.42} />
        </mesh>
      ))}

      {/* Rear wall */}
      <mesh position={[0, 2.5, -4.45]} receiveShadow>
        <boxGeometry args={[12, 5, 0.1]} />
        <meshStandardMaterial color="#241b17" roughness={0.92} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-5.95, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.1, 5, 9]} />
        <meshStandardMaterial color="#1b1512" />
      </mesh>

      <mesh position={[5.95, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.1, 5, 9]} />
        <meshStandardMaterial color="#1b1512" />
      </mesh>

      {/* Baseboards and upper trim */}
      <mesh position={[0, 0.18, -4.34]}>
        <boxGeometry args={[11.8, 0.22, 0.12]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.9} />
      </mesh>

      <mesh position={[0, 4.7, -4.34]}>
        <boxGeometry args={[11.8, 0.18, 0.12]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.9} />
      </mesh>

      <mesh position={[-5.84, 0.18, 0]}>
        <boxGeometry args={[0.12, 0.22, 8.8]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.9} />
      </mesh>

      <mesh position={[5.84, 0.18, 0]}>
        <boxGeometry args={[0.12, 0.22, 8.8]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.9} />
      </mesh>

      {/* Rear bookcases leave the middle wall free for the shared screen. */}
      <Bookcase position={[-4.15, 0, -4.18]} width={2.8} />
      <Bookcase position={[4.15, 0, -4.18]} width={2.8} />

      {/* Side bookcases rotate to face the room. */}
      <Bookcase
        position={[-5.55, 0, -1.45]}
        rotationY={Math.PI / 2}
        width={2.55}
      />
      <Bookcase
        position={[5.55, 0, -1.45]}
        rotationY={-Math.PI / 2}
        width={2.55}
      />

      {/* Shared room screen with wood frame */}
      <RoundedBox
        args={[3.7, 1.8, 0.18]}
        radius={0.14}
        smoothness={4}
        position={[0, 2.6, -4.29]}
      >
        <meshStandardMaterial color="#4b2f1f" roughness={0.82} />
      </RoundedBox>

      <RoundedBox
        args={[3.4, 1.5, 0.12]}
        radius={0.12}
        smoothness={4}
        position={[0, 2.6, -4.16]}
      >
        <meshStandardMaterial color="#0d0d0d" />
      </RoundedBox>

      {/* Decorative board-side pilasters */}
      {[-2.1, 2.1].map((x) => (
        <group key={x}>
          <RoundedBox
            args={[0.26, 3.65, 0.28]}
            radius={0.05}
            smoothness={2}
            position={[x, 1.9, -4.16]}
            castShadow
          >
            <meshStandardMaterial color="#4a2f20" roughness={0.88} />
          </RoundedBox>

          <RoundedBox
            args={[0.42, 0.15, 0.36]}
            radius={0.04}
            smoothness={2}
            position={[x, 3.72, -4.16]}
          >
            <meshStandardMaterial color="#6b472e" roughness={0.86} />
          </RoundedBox>
        </group>
      ))}

      {/* Warm wall sconces */}
      <WallSconce position={[-2.65, 3.65, -4.12]} />
      <WallSconce position={[2.65, 3.65, -4.12]} />

      {/* Reading tables */}
      <ReadingTable x={-3.3} accent="#3b2b24" />
      <ReadingTable x={0} accent="#2f3326" />
      <ReadingTable x={3.3} accent="#34273a" />

      {/* Warm overhead pools */}
      <pointLight
        position={[-3.3, 3.5, 0.6]}
        intensity={0.55}
        distance={5}
        decay={2}
        color="#f4d49a"
      />

      <pointLight
        position={[0, 3.5, 0.6]}
        intensity={0.55}
        distance={5}
        decay={2}
        color="#f4d49a"
      />

      <pointLight
        position={[3.3, 3.5, 0.6]}
        intensity={0.55}
        distance={5}
        decay={2}
        color="#f4d49a"
      />

      <Room3dOccupants seats={LIBRARY_SPATIAL_SEATS_3D} {...props} />
    </>
  );
}
