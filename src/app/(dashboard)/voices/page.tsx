import { voicesSearchPararmsCache } from "@/feature/voices/lib/params"
import { VoicesView } from "@/feature/voices/views/voices-view";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { Metadata } from "next"
import { SearchParams } from "nuqs/server"

export const metadata: Metadata = { title: "Voices"}

export default async function VoicesPage({ searchParams } : { searchParams: Promise<SearchParams> }) {
    const { query } = await voicesSearchPararmsCache.parse(searchParams);
    prefetch(trpc.voices.getAll.queryOptions({ query }));

    return (
        <HydrateClient>
            <VoicesView />
        </HydrateClient>
    )
}
