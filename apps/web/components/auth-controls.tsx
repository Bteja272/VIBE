import {
  auth,
  signIn,
  signOut,
} from "@/auth";

export default async function AuthControls() {
  const session =
    await auth();

  if (
    !session?.user
  ) {
    return (
      <form
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
    <div className="flex items-center gap-4">
      {session.user.image && (
        <img
          src={
            session.user.image
          }
          alt=""
          width={
            40
          }
          height={
            40
          }
          className="h-10 w-10 rounded-full"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-100">
          {session.user.name ??
            session.user.email}
        </p>

        {session.user.email && (
          <p className="truncate text-xs text-neutral-500">
            {
              session.user
                .email
            }
          </p>
        )}
      </div>

      <form
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
          className="rounded-lg border border-neutral-700 px-3 py-2 text-sm transition hover:border-neutral-500"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}