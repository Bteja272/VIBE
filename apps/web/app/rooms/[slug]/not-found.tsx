import Link from "next/link";

export default function RoomNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
          VIBE
        </p>

        <h1 className="mt-3 text-4xl font-semibold">
          Room not found
        </h1>

        <p className="mt-3 text-neutral-400">
          This room may have been deleted or the link may be incorrect.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950"
        >
          Back to rooms
        </Link>
      </div>
    </main>
  );
}