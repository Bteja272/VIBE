"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface OwnerRoomActionsProps {
  roomId: string;
  initialName: string;
  initialDescription: string | null;
  initialVisibility: "PUBLIC" | "PRIVATE";
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const OWNER_EMAIL = "dev@vibe.local";

export default function OwnerRoomActions({
  roomId,
  initialName,
  initialDescription,
  initialVisibility,
}: OwnerRoomActionsProps) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(
    initialDescription ?? "",
  );
  const [visibility, setVisibility] =
    useState<"PUBLIC" | "PRIVATE">(initialVisibility);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/rooms/${roomId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-dev-user-email": OWNER_EMAIL,
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
            visibility,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.message ??
            `Failed to update room: ${response.status}`,
        );
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update room",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this room? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/rooms/${roomId}`,
        {
          method: "DELETE",
          headers: {
            "x-dev-user-email": OWNER_EMAIL,
          },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.message ??
            `Failed to delete room: ${response.status}`,
        );
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete room",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500"
          >
            Edit room
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-700 disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete room"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
    >
      <div>
        <label
          htmlFor="owner-room-name"
          className="block text-sm font-medium"
        >
          Name
        </label>

        <input
          id="owner-room-name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          minLength={2}
          maxLength={80}
          required
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="owner-room-description"
          className="block text-sm font-medium"
        >
          Description
        </label>

        <textarea
          id="owner-room-description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          maxLength={300}
          rows={4}
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="owner-room-visibility"
          className="block text-sm font-medium"
        >
          Visibility
        </label>

        <select
          id="owner-room-visibility"
          value={visibility}
          onChange={(event) =>
            setVisibility(
              event.target.value as
                | "PUBLIC"
                | "PRIVATE",
            )
          }
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3"
        >
          <option value="PRIVATE">Private</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>

        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={loading}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}