import z from "zod";
import { createTRPCRouter, orgProcedure } from "../init";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { TEXT_MAX_LENGTH } from "@/feature/text-to-speech/data/constants";
import { chatterbox } from "@/lib/chatterbox-client";
import { uploadAudio } from "@/lib/r2";

const generateAudioSchema = z.object({
    text: z.string().min(1).max(TEXT_MAX_LENGTH),
    voiceId: z.string().min(1),
    temperature: z.number().min(0).max(2).default(0.8),
    topP: z.number().min(0).max(1).default(0.95),
    topK: z.number().min(1).max(10000).default(1000),
    repetitionPenalty: z.number().min(1).max(2).default(1.2),
});

export const generationsRouter = createTRPCRouter({
    // getById returns back a 'certain generation', one among many generated audios in the HISTORY panel
    getById: orgProcedure
        .input(z.object({
            id: z.string().trim()
        }))
        .query(async ({ ctx, input }) => {
            const generation = await prisma.generation.findUnique({
                where: { id: input.id, orgId: ctx.orgId },
                omit: {
                    orgId: true,
                    r2ObjectKey: true
                },
            });

            if (!generation) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            return {
                ...generation,
                audioUrl: `/api/audio/${generation.id}`,
            }
        }),

    getAll: orgProcedure.query(async ({ ctx }) => {
        const generations = await prisma.generation.findMany({
            where: { orgId: ctx.orgId },
            orderBy: { createdAt: "desc" },
            omit: {
                orgId: true,
                r2ObjectKey: true,
            }
        });

        if (!generations) {
            throw new TRPCError({ code: "NOT_FOUND" });
        }

        return generations;
    }),

    create: orgProcedure
        .input(generateAudioSchema)
        .mutation(async ({ ctx, input }) => {
            console.log("Inside the create ");
            console.log(input);
            const voice = await prisma.voice.findUnique({
                where: {
                    id: input.voiceId,
                    OR: [
                        { variant: "SYSTEM" },
                        { variant: "CUSTOM", orgId: ctx.orgId }
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    r2ObjectKey: true,
                },
            })

            if (!voice) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Voice not found",
                });
            }

            if (!voice.r2ObjectKey) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "Voice fetch not available"
                });
            }

            const { data, error } = await chatterbox.POST("/generate", {
                body: {
                    prompt: input.text,
                    voice_key: voice.r2ObjectKey,
                    temperature: input.temperature,
                    top_p: input.topP,
                    top_k: input.topK,
                    repetition_penalty: input.repetitionPenalty,
                    norm_loudness: true,
                },
                // Meaning of 'paresAs':
                //      const response = await fetch(...);
                //      const data = await response.arrayBuffer(); 
                // had the response from modal not been of 'audio/wav' format - const data = await response.json()
                parseAs: "arrayBuffer",
            });
            
            if (error) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to generate audio",
                });
            }

            const buffer = Buffer.from(data);
            let generationId: string | null = null;
            let r2ObjectKey: string | null = null;

            try {
                const generation = await prisma.generation.create({
                    data: {
                        orgId: ctx.orgId,
                        text: input.text,
                        voiceName: voice.name,
                        voiceId: voice.id,
                        temperature: input.temperature,
                        topP: input.topP,
                        topK: input.topK,
                        repetitionPenalty: input.repetitionPenalty,
                    },
                    select: { id: true },
                });

                generationId = generation.id;
                
                // The format in which the generations will be stored in R2 is: 
                // generations/orgs/<org-id>/<generation-id>
                r2ObjectKey = `generations/orgs/${ctx.orgId}/${generation?.id}`;

                await uploadAudio({ buffer, key: r2ObjectKey});

                await prisma.generation.update({
                    where: { id: generation.id },
                    data: { r2ObjectKey },
                });

            } catch (error) {
                // If we have the genId -> a db record has been created
                if (generationId){
                    // Following operation can be handled more elegantly using background jobs
                    await prisma.generation.delete({
                        where: { id: generationId },
                    }).catch(()=>{});
                }

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failded to store generated audio"
                });

                if (!generationId || !r2ObjectKey){
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to store generated audio",
                    })
                }
            }

            return { id: generationId }
        }),  
})