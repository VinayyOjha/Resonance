import { TextToSpeechView } from "@/feature/text-to-speech/views/text-to-speech-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Text to Speech"};

export default function TextToSpeechPage(){
    return (
        <TextToSpeechView />
    )
}