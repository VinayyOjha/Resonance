import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from 'superjson';

export const createTRPCContext = {};

const t = initTRPC.create({
    transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// Authenticated procedure - calls auth() only when neeeded
export const authProcedure = t.procedure.use(async ({ next }) => {
    const { userId, orgId } = await auth();

    if (!userId){
        throw new TRPCError({ code: "UNAUTHORIZED"});
    }

    return next({
        ctx: { userId, orgId },
    });
});

// Organization procedure - requires userId and orgId
export const orgProcedure = t.procedure.use( async({ next }) => {
    const { userId, orgId } = await auth();

    if (!userId){
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (!orgId){
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "Organisation required",
        });
    }

    return next({
        ctx: { userId, orgId }
    });
});