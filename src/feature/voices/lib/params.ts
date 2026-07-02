import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const voicesSearchPararms = {
    // MEANS: 
    // Read the query parameter from the URL, parse it as string and if it doesnt exist use "" instead
    // URL: /voices?query=aaron  --> parsed value= "aaron"
    query: parseAsString.withDefault("",)
};
// It creates a cache that parses the URL once and lets multiple Server Components access the parsed values without re-parsing.
export const voicesSearchPararmsCache = createSearchParamsCache(voicesSearchPararms);