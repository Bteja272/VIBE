"use client";

import { useRef } from "react";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh, PointLight } from "three";

import Room3dOccupants from "@/components/room-3d-occupants";
import type { Room3dEnvironmentProps } from "@/components/room-3d-environment-types";
import { CAMPFIRE_SPATIAL_SEATS_3D } from "@/src/lib/spatial-layout";

const FIRE_STONES = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2;

  return {
    key: `stone-${index}`,
    position: [
      Math.cos(angle) * 0.9,
      0.16,
      Math.sin(angle) * 0.9,
    ] as [number, number, number],
    rotationY: -angle,
  };
});

export default function Room3dCampfireEnvironment(
  props: Room3dEnvironmentProps,
) {
  const outerFlameRef = useRef<Mesh>(null);
  const innerFlameRef = useRef<Mesh>(null);
  const emberGlowRef = useRef<Mesh>(null);
  const fireLightRef = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;

    if (outerFlameRef.current) {
      outerFlameRef.current.scale.y =
        1 + Math.sin(elapsed * 6.1) * 0.1 + Math.sin(elapsed * 10.7) * 0.04;

      outerFlameRef.current.rotation.y = Math.sin(elapsed * 2.2) * 0.16;
    }

    if (innerFlameRef.current) {
      innerFlameRef.current.scale.y =
        1 + Math.sin(elapsed * 7.4 + 1.2) * 0.08;

      innerFlameRef.current.rotation.y =
        -Math.sin(elapsed * 2.8 + 0.5) * 0.12;
    }

    if (emberGlowRef.current) {
      const pulse = 1 + Math.sin(elapsed * 5.2) * 0.05;
      emberGlowRef.current.scale.set(pulse, pulse, pulse);
    }

    if (fireLightRef.current) {
      fireLightRef.current.intensity =
        2.5 +
        Math.sin(elapsed * 7.3) * 0.22 +
        Math.sin(elapsed * 13.1) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.32} />

      <directionalLight
        position={[3, 7, 4]}
        intensity={0.55}
        color="#c7d2fe"
      />

      <pointLight
        ref={fireLightRef}
        position={[0, 1.55, 0]}
        intensity={2.5}
        distance={8}
        decay={2}
        color="#fb923c"
      />

      {/* Outdoor ground */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[7.4, 7.4, 0.16, 48]} />
        <meshStandardMaterial color="#101811" roughness={0.95} />
      </mesh>

      {/* Gathering patch */}
      <mesh
        position={[0, 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[4.9, 48]} />
        <meshStandardMaterial color="#24231d" roughness={1} />
      </mesh>

      {/* Soft firelight pool */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.45, 48]} />
        <meshBasicMaterial
          color="#7c2d12"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>

      {/* Stone fire ring */}
      {FIRE_STONES.map((stone) => (
        <mesh
          key={stone.key}
          position={stone.position}
          rotation={[0, stone.rotationY, 0]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial color="#57534e" roughness={0.95} />
        </mesh>
      ))}

      {/* Crossed logs */}
      <RoundedBox
        args={[1.28, 0.2, 0.28]}
        radius={0.07}
        smoothness={3}
        position={[0, 0.24, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
      >
        <meshStandardMaterial color="#4a2d1d" roughness={0.92} />
      </RoundedBox>

      <RoundedBox
        args={[1.28, 0.2, 0.28]}
        radius={0.07}
        smoothness={3}
        position={[0, 0.25, 0]}
        rotation={[0, -Math.PI / 4, 0]}
        castShadow
      >
        <meshStandardMaterial color="#5a3822" roughness={0.92} />
      </RoundedBox>

      {/* Ember bed */}
      <mesh ref={emberGlowRef} position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.4, 16, 12]} />
        <meshStandardMaterial
          color="#fb923c"
          emissive="#ea580c"
          emissiveIntensity={1.7}
        />
      </mesh>

      {/* Outer flame */}
      <mesh ref={outerFlameRef} position={[0, 0.92, 0]}>
        <coneGeometry args={[0.42, 1.45, 12]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#ea580c"
          emissiveIntensity={2}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Inner flame */}
      <mesh ref={innerFlameRef} position={[0.04, 0.83, 0.02]}>
        <coneGeometry args={[0.23, 1.0, 10]} />
        <meshStandardMaterial
          color="#fde047"
          emissive="#facc15"
          emissiveIntensity={2.4}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Freestanding shared room screen */}
      <mesh position={[-1.85, 1.9, -4.42]} castShadow>
        <boxGeometry args={[0.16, 3.6, 0.16]} />
        <meshStandardMaterial color="#292524" />
      </mesh>

      <mesh position={[1.85, 1.9, -4.42]} castShadow>
        <boxGeometry args={[0.16, 3.6, 0.16]} />
        <meshStandardMaterial color="#292524" />
      </mesh>

      <RoundedBox
        args={[3.4, 1.5, 0.12]}
        radius={0.12}
        smoothness={4}
        position={[0, 2.6, -4.32]}
      >
        <meshStandardMaterial color="#111111" />
      </RoundedBox>

      <Room3dOccupants seats={CAMPFIRE_SPATIAL_SEATS_3D} {...props} />
    </>
  );
}
