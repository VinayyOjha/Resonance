"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayback(src: string | File | null){
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // clean-up function; runs before src changes and when the comp unmounts
        return () => {
            if (audioRef.current) {
                audioRef.current.pause(); // Stops audio 

                // Releasing the audio source
                audioRef.current.removeAttribute("src"); 
                audioRef.current = null; // Delete the references
            }
        }
    }, [src]);

    // 1. Creating a memoized function
    // 2. Whenever either of [src, isPlaying] changes, React creates a new function
    const togglePlay = useCallback(() => {
        if (!src) return;

        // First play. If audio object doesn't exist, create it.
        if (!audioRef.current){
            const url = src instanceof File ? URL.createObjectURL(src) : src;
            audioRef.current = new Audio(url); // Create audio

            // When song finishes, button changes back to play.
            audioRef.current.addEventListener("ended", () => setIsPlaying(false));
            audioRef.current.addEventListener("canplaythrough", () => setIsLoading(false), { once: true});
        }

        // Pause logic
        if (isPlaying){
            audioRef.current.pause();
            setIsPlaying(false);
        }
        
        // Play logic
        else {
            setIsLoading(true);

            // play() return a Promise because playback may be delayed or rejected. If it succeds -> then(() => ...)
            audioRef.current.play().then(() => {
                setIsLoading(false); // Show loading spinner
                setIsPlaying(true); // Update UI
            })
            .catch((error) => {
                setIsLoading(false);
                setIsPlaying(false);
                console.error("Playback failed: ", error);
            });
        }
    }, [src, isPlaying]); // togglePlay is only created when src or isPlaying changes

    return { isPlaying, isLoading, togglePlay };
}