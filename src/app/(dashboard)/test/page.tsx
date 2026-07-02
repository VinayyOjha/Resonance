import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { HealthCheck } from "./health-check";
import { Suspense } from "react";

export default function TestPage() {
  prefetch(trpc.health.queryOptions());

  return (
    <HydrateClient>
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">tRPC test page</h1>
        <Suspense fallback={
            <div>Loading...</div>
        }>
          <HealthCheck />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
