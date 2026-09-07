import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import VibeProfileSetup from "@/components/vibe-profile-setup";

export default async function OnboardingPage() {
  const session =
    await auth();

  if (
    !session?.user?.email
  ) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-md">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-neutral-500">
          VIBE
        </p>

        <h1 className="text-3xl font-semibold">
          Choose your VIBE name
        </h1>

        <p className="mt-3 text-sm text-neutral-400">
          This is what other people will see in rooms.
          Your Google email remains private account information.
        </p>

        <div className="mt-8">
          <VibeProfileSetup />
        </div>
      </div>
    </main>
  );
}