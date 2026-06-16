import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
});

const globalPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalPrisma.prisma = prisma

export { prisma };