"use client";

import { FormEvent, useEffect, useState } from "react";

import { socket } from "@/src/lib/socket";

interface ChatMessage {
  id: string;
  roomId: string;
  presenceId: string;
  userEmail: string;
  content: string;
  createdAt: string;
}

interface ChatHistoryResponse {
  roomId: string;
  messages: ChatMessage[];
}

interface RoomChatProps {
  roomId: string;
  canSend: boolean;
}

export default function RoomChat({ roomId, canSend }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [message, setMessage] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    function handleMessage(incoming: ChatMessage) {
      if (incoming.roomId !== roomId) {
        return;
      }

      setMessages((current) => {
        if (current.some((item) => item.id === incoming.id)) {
          return current;
        }

        return [...current, incoming].slice(-50);
      });
    }

    socket.on("chat:message", handleMessage);

    function loadHistory() {
      socket.emit(
        "chat:history",
        undefined,
        (response: ChatHistoryResponse) => {
          if (response?.roomId === roomId) {
            setMessages(response.messages ?? []);
          }
        },
      );
    }

    if (socket.connected) {
      loadHistory();
    }

    socket.on("connect", loadHistory);

    return () => {
      socket.off("chat:message", handleMessage);

      socket.off("connect", loadHistory);
    };
  }, [roomId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = message.trim();

    if (!content) {
      return;
    }

    setError(null);
    setSending(true);

    socket.timeout(5000).emit(
      "chat:send",
      {
        content,
      },
      (
        timeoutError: Error | null,
        response?: {
          sent: boolean;
          error?: string;
          message?: ChatMessage;
        },
      ) => {
        setSending(false);

        if (timeoutError) {
          setError("The server did not respond. Please try again.");

          return;
        }

        if (!response?.sent) {
          setError(response?.error ?? "Unable to send message");

          return;
        }

        setMessage("");
      },
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div>
        <h2 className="text-lg font-semibold">Room chat</h2>

        <p className="mt-1 text-sm text-neutral-500">Recent room messages</p>
      </div>

      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet.</p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="rounded-xl bg-neutral-950 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{item.userEmail}</p>

                <time className="text-xs text-neutral-600">
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>

              <p className="mt-2 break-words text-sm text-neutral-300">
                {item.content}
              </p>
            </div>
          ))
        )}
      </div>

      {canSend ? (
        <form onSubmit={handleSubmit} className="mt-5 flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            placeholder="Say something..."
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none"
          />

          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      ) : (
        <p className="mt-5 text-sm text-neutral-500">Join the room to chat.</p>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
