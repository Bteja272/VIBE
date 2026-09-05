import CreateRoomForm from "@/components/create-room-form";

export default function NewRoomPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold">
          Create a room
        </h1>

        <p className="mt-2 text-neutral-400">
          Set up a new VIBE space.
        </p>

        <div className="mt-8">
          <CreateRoomForm />
        </div>
      </div>
    </main>
  );
}