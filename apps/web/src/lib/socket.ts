import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const HEARTBEAT_INTERVAL_MS = 25_000;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});

let activeToken: string | null = null;

let heartbeatTimer: number | null = null;

export function startPresenceHeartbeat() {
  if (typeof window === "undefined") {
    return;
  }

  stopPresenceHeartbeat();

  /*
   * Send one immediately after successful
   * presence entry, then every 25 seconds.
   */
  socket.emit("presence:heartbeat");

  heartbeatTimer = window.setInterval(() => {
    if (socket.connected) {
      socket.emit("presence:heartbeat");
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopPresenceHeartbeat() {
  if (typeof window === "undefined" || heartbeatTimer === null) {
    return;
  }

  window.clearInterval(heartbeatTimer);

  heartbeatTimer = null;
}

export async function ensureSocketConnection(token?: string): Promise<void> {
  const nextToken = token ?? null;

  if (socket.connected && activeToken === nextToken) {
    return;
  }

  activeToken = nextToken;

  socket.auth = nextToken
    ? {
        token: nextToken,
      }
    : {};

  if (socket.connected) {
    socket.disconnect();
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();

      reject(new Error("Socket connection timed out"));
    }, 5000);

    function cleanup() {
      window.clearTimeout(timeout);

      socket.off("connect", handleConnect);

      socket.off("connect_error", handleError);
    }

    function handleConnect() {
      cleanup();

      resolve();
    }

    function handleError(error: Error) {
      cleanup();

      reject(error);
    }

    socket.once("connect", handleConnect);

    socket.once("connect_error", handleError);

    socket.connect();
  });
}
