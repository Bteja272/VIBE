"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function CreateRoomForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] =
    useState<"PUBLIC" | "PRIVATE">("PRIVATE");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@vibe.local",
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          visibility,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.message
            ? Array.isArray(body.message)
              ? body.message.join(", ")
              : body.message
            : `Failed to create room: ${response.status}`,
        );
      }

      const room = await response.json();

      router.push(`/rooms/${room.slug}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
    >
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium"
        >
          Room name
        </label>

        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={80}
          required
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
          placeholder="Late Night Study"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium"
        >
          Description
        </label>

        <textarea
          id="description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          maxLength={300}
          rows={4}
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
          placeholder="What is this room for?"
        />
      </div>

      <div>
        <label
          htmlFor="visibility"
          className="block text-sm font-medium"
        >
          Visibility
        </label>

        <select
          id="visibility"
          value={visibility}
          onChange={(event) =>
            setVisibility(
              event.target.value as "PUBLIC" | "PRIVATE",
            )
          }
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
        >
          <option value="PRIVATE">Private</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create room"}
      </button>
    </form>
  );
}