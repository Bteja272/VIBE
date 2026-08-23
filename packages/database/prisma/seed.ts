import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "../src/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({
  path: resolve(__dirname, "../../../.env"),
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = createPrismaClient(databaseUrl);

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: {
        email: "dev@vibe.local",
      },
      update: {},
      create: {
        email: "dev@vibe.local",
        displayName: "VIBE Dev",
      },
    }),

    prisma.user.upsert({
      where: {
        email: "dev2@vibe.local",
      },
      update: {},
      create: {
        email: "dev2@vibe.local",
        displayName: "VIBE Guest",
      },
    }),
  ]);

  console.log(
    "Development users ready:",
    users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });