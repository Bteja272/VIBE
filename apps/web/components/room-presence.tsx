'use client';

import { useEffect, useState } from 'react';

import { socket } from '@/src/lib/socket';

interface RoomPresenceProps {
  roomId: string;
}

interface PresenceEvent {
  socketId: string;
  roomId: string;
  userEmail: string;
}

const DEV_USER_EMAIL = 'dev2@vibe.local';

export default function RoomPresence({
  roomId,
}: RoomPresenceProps) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<PresenceEvent[]>([]);

  useEffect(() => {
    function handleConnect() {
      setConnected(true);

      socket.emit(
        'room:join',
        {
          roomId,
          userEmail: DEV_USER_EMAIL,
        },
        (response: {
          joined: boolean;
          roomId: string;
        }) => {
          console.log('Joined socket room:', response);
        },
      );
    }

    function handleDisconnect() {
      setConnected(false);
    }

    function handlePresenceJoined(
      event: PresenceEvent,
    ) {
      setEvents((current) => [...current, event]);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(
      'presence:joined',
      handlePresenceJoined,
    );

    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(
        'presence:joined',
        handlePresenceJoined,
      );

      socket.disconnect();
    };
  }, [roomId]);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Live presence
        </h2>

        <span className="text-sm text-neutral-400">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <p className="mt-3 text-sm text-neutral-400">
        Socket events received: {events.length}
      </p>

      {events.length > 0 && (
        <div className="mt-4 space-y-2">
          {events.map((event, index) => (
            <div
              key={`${event.socketId}-${index}`}
              className="rounded-lg bg-neutral-950 px-3 py-2 text-sm"
            >
              {event.userEmail} joined
            </div>
          ))}
        </div>
      )}
    </section>
  );
}