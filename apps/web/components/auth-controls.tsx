import { auth, signIn, signOut } from "@/auth";

export default async function AuthControls() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";

          await signIn("google", {
            redirectTo: "/",
          });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
        >
          Sign in with Google
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-sm font-medium text-neutral-100">
          {session.user.name ??
            session.user.email}
        </p>

        {session.user.email && (
          <p className="text-xs text-neutral-500">
            {session.user.email}
          </p>
        )}
      </div>

      {session.user.image && (
        <img
          src={session.user.image}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 rounded-full"
        />
      )}

      <form
        action={async () => {
          "use server";

          await signOut({
            redirectTo: "/",
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
    </div>
  );
}