"use client";

import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";

import { PerspectiveCamera, Vector3 } from "three";

import { Canvas, useThree } from "@react-three/fiber";

import { Environment } from "@react-three/drei";

import type {
  Room3dBoardSurfaceDefinition,
  Room3dCameraDefinition,
} from "@/components/room-3d-environment-types";
import {
  getRoom3dEnvironmentDefinition,
  type Room3dEnvironmentId,
} from "@/components/room-3d-environments";
import RoomBoardSurface from "@/components/room-board-surface";
import type { MusicPlaybackState } from "@/components/shared-youtube-player";
import type { RoomBoardState } from "@/src/types/board";

import type { SpatialParticipant } from "@/src/lib/spatial-layout";

interface Room3dSceneProps {
  className?: string;

  environmentId?: Room3dEnvironmentId;

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

  boardState?: RoomBoardState | null;

  boardHidden?: boolean;

  boardPlayback?: MusicPlaybackState | null;

  onWebglFailure?: () => void;
}

interface BoardScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WebglErrorBoundaryProps {
  children: ReactNode;
  onFailure: () => void;
}

interface WebglErrorBoundaryState {
  failed: boolean;
}

/*
 * React Three Fiber ultimately depends on the browser creating a WebGL
 * rendering context. A React error boundary catches initialization/render
 * failures that would otherwise leave the room blank.
 */
class WebglErrorBoundary extends Component<
  WebglErrorBoundaryProps,
  WebglErrorBoundaryState
> {
  state: WebglErrorBoundaryState = {
    failed: false,
  };

  static getDerivedStateFromError(): WebglErrorBoundaryState {
    return {
      failed: true,
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("3D room failed to render:", error, info);

    this.props.onFailure();
  }

  render() {
    if (this.state.failed) {
      return null;
    }

    return this.props.children;
  }
}

function WebglContextGuard({ onFailure }: { onFailure: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    function handleContextLost(event: Event) {
      /*
       * Prevent the browser's default restoration loop because VIBE
       * immediately falls back to the existing 2D room instead.
       */
      event.preventDefault();

      onFailure();
    }

    canvas.addEventListener("webglcontextlost", handleContextLost);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
    };
  }, [gl, onFailure]);

  return null;
}

function SceneViewportSync({
  cameraDefinition,
  boardSurface,
  onBoardRectChange,
}: {
  cameraDefinition: Room3dCameraDefinition;
  boardSurface: Room3dBoardSurfaceDefinition;
  onBoardRectChange: (rect: BoardScreenRect) => void;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (
      !(camera instanceof PerspectiveCamera) ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      return;
    }

    const aspect = size.width / size.height;

    /*
     * Keep the current desktop composition unchanged.
     *
     * On narrower containers, widen the vertical FOV just enough
     * to preserve more of the room horizontally instead of
     * cropping the left/right seats.
     */
    const baseFovRadians = (cameraDefinition.fov * Math.PI) / 180;

    const responsiveFov =
      aspect < cameraDefinition.responsiveReferenceAspect
        ? (2 *
            Math.atan(
              Math.tan(baseFovRadians / 2) *
                (cameraDefinition.responsiveReferenceAspect / aspect),
            ) *
            180) /
          Math.PI
        : cameraDefinition.fov;

    camera.fov = Math.min(cameraDefinition.maxResponsiveFov, responsiveFov);

    camera.updateProjectionMatrix();

    camera.updateMatrixWorld();

    const topLeft = new Vector3(...boardSurface.topLeft).project(camera);

    const bottomRight = new Vector3(...boardSurface.bottomRight).project(camera);

    const left = ((topLeft.x + 1) / 2) * size.width;

    const top = ((1 - topLeft.y) / 2) * size.height;

    const right = ((bottomRight.x + 1) / 2) * size.width;

    const bottom = ((1 - bottomRight.y) / 2) * size.height;

    onBoardRectChange({
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    });
  }, [
    camera,
    size.width,
    size.height,
    cameraDefinition,
    boardSurface,
    onBoardRectChange,
  ]);

  return null;
}


export default function Room3dScene({
  className,
  environmentId = "LOUNGE",
  users,
  assignments,
  currentUserId = null,
  onSeatClick,
  onParticipantClick,
  selectedParticipantId = null,
  dmUnreadCounts = {},
  activeBubbles = {},
  onChatBubbleClick,
  boardState = null,
  boardHidden = false,
  boardPlayback = null,
  onWebglFailure,
}: Room3dSceneProps) {
  const [boardRect, setBoardRect] = useState<BoardScreenRect | null>(null);

  const environmentDefinition =
    getRoom3dEnvironmentDefinition(environmentId);

  const EnvironmentComponent = environmentDefinition.Component;

  const handleBoardRectChange = useCallback((nextRect: BoardScreenRect) => {
    setBoardRect((current) => {
      if (
        current &&
        Math.abs(current.left - nextRect.left) < 0.5 &&
        Math.abs(current.top - nextRect.top) < 0.5 &&
        Math.abs(current.width - nextRect.width) < 0.5 &&
        Math.abs(current.height - nextRect.height) < 0.5
      ) {
        return current;
      }

      return nextRect;
    });
  }, []);

  const handleWebglFailure = useCallback(() => {
    onWebglFailure?.();
  }, [onWebglFailure]);

  return (
    <div
      className={
        className ?? "relative h-full min-h-[520px] w-full sm:min-h-[620px]"
      }
    >
      <WebglErrorBoundary onFailure={handleWebglFailure}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: environmentDefinition.camera.position,
            fov: environmentDefinition.camera.fov,
          }}
          gl={{
            antialias: true,
          }}
        >
          <color attach="background" args={[environmentDefinition.background]} />

          <WebglContextGuard onFailure={handleWebglFailure} />

          <SceneViewportSync
            cameraDefinition={environmentDefinition.camera}
            boardSurface={environmentDefinition.boardSurface}
            onBoardRectChange={handleBoardRectChange}
          />

          <EnvironmentComponent
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

          <Environment preset={environmentDefinition.lightingPreset} />
        </Canvas>
      </WebglErrorBoundary>

      {/*
       * YouTube remains a DOM player, but its container is now positioned
       * from the actual projected 3D board coordinates.
       *
       * The wrapper never accepts pointer events, so board media cannot
       * block chairs, avatars, or any other Canvas interaction.
       */}
      {boardRect && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: boardRect.left,
            top: boardRect.top,
            width: boardRect.width,
            height: boardRect.height,
          }}
        >
          <RoomBoardSurface
            state={boardState}
            hidden={boardHidden}
            linkedPlayback={boardPlayback}
            className="h-full w-full rounded-[0.35rem] border border-neutral-800/70 shadow-sm"
          />
        </div>
      )}
    </div>
  );
}
