import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { voicesRouter } from "./voices";
import { generationsRouter } from "./routers";

export const appRouter = createTRPCRouter({
    health: baseProcedure
        .query(async () => {
            return {
                status: "ok",
                greetMessage: "Kaise ho?"
            }
        }),
    voices: voicesRouter,
    generations: generationsRouter,
});

export type AppRouter = typeof appRouter;