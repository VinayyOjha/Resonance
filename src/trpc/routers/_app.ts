import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
    hello: baseProcedure
        .input(
            z.object({
                text: z.string(),
            }),
        )
        .query((opts) => {
            return {
                greeting: `hweello ${opts.input.text}`,
            };
        }),
    health: baseProcedure
        .query(async () => {
            return {
                status: "ok",
                greetMessage: "Kaise ho?"
            }
        }),
});

export type AppRouter = typeof appRouter;