"use client";

import { useTRPC } from "@/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query";

export function HealthCheck(){
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.health.queryOptions());

    return(
        <div className="rounded-lg border p-6 text-center">
            <div className="text-muted-foreground text-sm">tRPC Status</div>
            <p className="mt-2 text-lg font-semibold">{data.status}</p>
        </div>
    )
}