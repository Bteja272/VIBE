import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function GET() {
  const session = await auth();

  if (
    !session?.user ||
    !session.user.email
  ) {
    return NextResponse.json(
      {
        message: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const backendUrl =
    process.env.BACKEND_API_URL ??
    "http://localhost:4000";

  const internalSecret =
    process.env.VIBE_INTERNAL_SECRET;

  if (!internalSecret) {
    console.error(
      "VIBE_INTERNAL_SECRET is not configured",
    );

    return NextResponse.json(
      {
        message:
          "Authentication is not configured",
      },
      {
        status: 500,
      },
    );
  }

  const response = await fetch(
    `${backendUrl}/auth/registered`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-vibe-internal-secret":
          internalSecret,
      },

      body: JSON.stringify({
        email:
          session.user.email,

        displayName:
          session.user.name ??
          session.user.email,

        imageUrl:
          session.user.image ??
          undefined,
      }),

      cache: "no-store",
    },
  );

  const body =
    await response.json();

  if (!response.ok) {
    return NextResponse.json(
      body,
      {
        status:
          response.status,
      },
    );
  }

  return NextResponse.json(body);
}