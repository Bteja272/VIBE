import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "../src/client.js";

// ESM does not provide __dirname directly.
// Reconstruct it from the current module's URL.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// seed.ts is:
// VIBE/packages/database/prisma/seed.ts
//
// ../../../.env resolves to:
// VIBE/.env
config({
  path: resolve(__dirname, "../../../.env"),
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = createPrismaClient(databaseUrl);

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: "dev@vibe.local",
    },
    update: {},
    create: {
      email: "dev@vibe.local",
      displayName: "VIBE Dev",
    },
  });

  console.log("Development user ready:", {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });