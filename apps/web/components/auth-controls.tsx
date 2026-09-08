import {
  auth,
  signIn,
  signOut,
} from "@/auth";

interface AuthControlsProps {
  className?: string;
}

export default async function AuthControls({
  className,
}: AuthControlsProps) {
  const session =
    await auth();

  if (
    !session?.user
  ) {
    return (
      <form
        className={
          className
        }
        action={async () => {
          "use server";

          await signIn(
            "google",
            {
              redirectTo:
                "/onboarding",
            },
          );
        }}
      >
        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
        >
          Continue with Google
        </button>
      </form>
    );
  }

  return (
    <form
      className={
        className
      }
      action={async () => {
        "use server";

        await signOut({
          redirectTo:
            "/",
        });
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500"
      >
        Sign out
      </button>
    </form>
  );
}