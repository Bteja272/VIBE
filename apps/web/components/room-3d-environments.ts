import type { ComponentType } from "react";

import LoungeRoom3dEnvironment from "@/components/room-3d-environment";
import type {
  Room3dBoardSurfaceDefinition,
  Room3dCameraDefinition,
  Room3dEnvironmentProps,
} from "@/components/room-3d-environment-types";

export type Room3dEnvironmentId = "LOUNGE";

export interface Room3dEnvironmentDefinition {
  id: Room3dEnvironmentId;
  label: string;
  Component: ComponentType<Room3dEnvironmentProps>;
  background: string;
  lightingPreset: "city";
  camera: Room3dCameraDefinition;
  boardSurface: Room3dBoardSurfaceDefinition;
}

const LOUNGE_ENVIRONMENT: Room3dEnvironmentDefinition = {
  id: "LOUNGE",
  label: "Lounge",
  Component: LoungeRoom3dEnvironment,
  background: "#0a0a0a",
  lightingPreset: "city",

  camera: {
    position: [0, 7.2, 10.5],
    fov: 44,
    responsiveReferenceAspect: 1.35,
    maxResponsiveFov: 68,
  },

  boardSurface: {
    topLeft: [-1.55, 3.25, -4.24],
    bottomRight: [1.55, 1.95, -4.24],
  },
};

export const ROOM_3D_ENVIRONMENTS: Record<
  Room3dEnvironmentId,
  Room3dEnvironmentDefinition
> = {
  LOUNGE: LOUNGE_ENVIRONMENT,
};

export function getRoom3dEnvironmentDefinition(
  environmentId: Room3dEnvironmentId,
): Room3dEnvironmentDefinition {
  return ROOM_3D_ENVIRONMENTS[environmentId] ?? LOUNGE_ENVIRONMENT;
}