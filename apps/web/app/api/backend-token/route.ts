import { SignJWT } from "jose";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function GET() {
  const session = await auth();

  if (
    !session?.user?.id ||
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

  const secret =
    process.env.BACKEND_JWT_SECRET;

  if (!secret) {
    console.error(
      "BACKEND_JWT_SECRET is not configured",
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

  const encodedSecret =
    new TextEncoder().encode(secret);

  const token =
    await new SignJWT({
      email: session.user.email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    })
      .setProtectedHeader({
        alg: "HS256",
      })
      .setSubject(
        session.user.id,
      )
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer("vibe-web")
      .setAudience("vibe-api")
      .sign(encodedSecret);

  return NextResponse.json({
    token,
    expiresIn: 900,
  });
}