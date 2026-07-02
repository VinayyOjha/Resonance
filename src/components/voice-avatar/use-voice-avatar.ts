import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { glass } from "@dicebear/collection";

// A custom React hook that generates a unique avatar image for a voice based on a string(seed).
/**
 * 1. When we pass a seed like-
 *      const avatar = useVoiceAvatar("Narrator");
 * 
 * 2. it returns a Data URI string that can be used directly in an image tag as-
 *      <img src={avatar} alt="Voice Avatar" />
 */
export function useVoiceAvatar(seed: string) {
    // useMemo caches a computed value so it isnt recalculated on every render  
    // W/o useMemo the avatar would be regenerated every render
    return useMemo(() => {
        return createAvatar(glass, {
            seed,
            size: 128,
        }).toDataUri(); // this converts the genr. SVG into a string like: data:image/svg+xml

        // DEPENDENCY ARRAY: Only regenerate avatar when seed changes
    }, [seed]);
};