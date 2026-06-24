import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { deleteAudio } from "@/lib/r2";
import { createTRPCRouter, orgProcedure } from "../init";

export const voicesRouter = createTRPCRouter({
    getAll: orgProcedure
        .input(z.object({ query: z.string().trim().optional() }).optional())
        .query(async ({ ctx, input }) => {
            const searchFilter = input?.query
                ? {
                    // This is filter on search on 'search by name OR description'
                    OR: 
                    [
                        {
                            name: {
                                contains: input.query, mode: "insensitive" as const
                            }
                        },
                        {
                            description: {
                                contains: input.query,
                                mode: "insensitive" as const,
                            },
                        },
                    ],
                }
                : {};

            const [custom, system] = await Promise.all([
                prisma.voice.findMany({
                    where: {
                        variant: "CUSTOM",
                        orgId: ctx.orgId,
                        ...searchFilter,
                    },
                    // Newest first
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        category: true,
                        language: true,
                        variant: true,
                    },
                }),
                prisma.voice.findMany({
                    where: {
                        variant: "SYSTEM",
                        ...searchFilter,
                    },
                    orderBy: { name: "asc" },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        category: true,
                        language: true,
                        variant: true,
                    }
                }),
            ]);

            return { custom, system };
        }),

    delete: orgProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const voice = await prisma.voice.findFirst({
                where: {
                    id: input.id,
                    variant: "CUSTOM",
                    orgId: ctx.orgId
                },
                select: { id: true, r2ObjectKey: true },
            });

            if (!voice) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Voice not found",
                });
            }

            // Clean up r2
            if (voice.r2ObjectKey) {
                // In produciton, use background jobs, retries, cron jobs.
                await deleteAudio(voice.r2ObjectKey).catch(() => {
                    throw new TRPCError({
                        code: "GATEWAY_TIMEOUT",
                        message: "Could not clear voice from cloud"
                    });
                });
            }

            await prisma.voice.delete({ where: { id: input.id } });

            return { success: true };
        })
});