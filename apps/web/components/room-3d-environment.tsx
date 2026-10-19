"use client";

import { RoundedBox } from "@react-three/drei";

import Room3dOccupants from "@/components/room-3d-occupants";
import type { Room3dEnvironmentProps } from "@/components/room-3d-environment-types";
import { SPATIAL_SEATS_3D } from "@/src/lib/spatial-layout";

export default function Room3dEnvironment(props: Room3dEnvironmentProps) {
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

      <Room3dOccupants seats={SPATIAL_SEATS_3D} {...props} />
    </>
  );
}
