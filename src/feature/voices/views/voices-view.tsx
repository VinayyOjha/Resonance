"use client";

/*
    User types
    "dylan"
        │
        ▼
    localQuery updates
        │
        ▼
    Input immediately shows "dylan"
        │
    (wait 300 ms)
        ▼
    setQuery("dylan")
        │
        ▼
    URL becomes

    /voices?query=dylan
        │
        ▼
    Server reads searchParams
        │
        ▼
    query = "dylan"
        │
        ▼
    Database query

    SELECT *
    FROM voices
    WHERE name LIKE '%dylan%'
        │
        ▼
    Returns Dylan
        │
        ▼
    voices.map(...)
        │
        ▼
    VoiceCard(Dylan)
*/

import { useTRPC } from "@/trpc/client";
import { useQueryState } from "nuqs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { VoicesList } from "../components/voices-list";
import { voicesSearchPararms } from "../lib/params";
import { VoicesToolbar } from "../components/voices-toolbar";

function VoicesContent(){
    const trpc = useTRPC();
    // Suppose the browser URL is - /voices?query=andy, the following line returns query = "andy". 
    // If no query is present, then - query = ""
    const [query] = useQueryState("query", voicesSearchPararms.query);

    // The query is then used to fetch that particular voice from the DB
    const { data } = useSuspenseQuery(trpc.voices.getAll.queryOptions({ query }));

    return (
        <>
            <VoicesList title="Team Voices" voices={data.custom} />
            <VoicesList title="Built-in Voices" voices={data.system} />
        </>
    )
}

/**
 * Why don't you manually tell VoicesList to filter?

    Because VoicesList is a presentational component. It doesn't know anything about searching. It simply renders whatever array it's given:

    <VoicesList voices={data.system} />
    If data.system has 50 voices, it renders 50 cards.
    If data.system has 1 voice, it renders 1 card.
    If data.system is empty, it renders no cards.

    The filtering responsibility belongs to the data-fetching layer (trpc.voices.getAll), while VoicesList just displays the results. This separation keeps each component focused on a single responsibility.
 */

export function VoicesView() {
  return (
    <div className="flex-1 space-y-10 overflow-y-auto p-3 lg:p-6">
        <VoicesToolbar />
        <VoicesContent />
    </div>
  );
};