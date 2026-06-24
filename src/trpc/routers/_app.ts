import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { voicesRouter } from "./voices";

export const appRouter = createTRPCRouter({
    health: baseProcedure
        .query(async () => {
            return {
                status: "ok",
                greetMessage: "Kaise ho?"
            }
        }),
    voices: voicesRouter,
});

export type AppRouter = typeof appRouter;