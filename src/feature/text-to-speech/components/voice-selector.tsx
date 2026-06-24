import { useTypedAppFormContext } from "@/hooks/use-app-form";
import { VoiceAvatar } from "@/components/voice-avatar/voice-avatar";
import { useTTSVoices } from "../contexts/tts-voices-context";
import { ttsFormOptions } from "./text-to-speech-form";
import { useStore } from "@tanstack/react-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator } from "@/components/ui/select";
import { VOICE_CATEGORY_LABELS } from "@/feature/voices/data/voice-categories";
export function VoiceSelector(){
    // Consuming the TTSContext
    const { customVoices, systemVoices, allVoices: voices } = useTTSVoices();

    const form = useTypedAppFormContext(ttsFormOptions);
    const voiceId = useStore(form.store, (s) => s.values.voiceId);
    const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

    const selectedVoice = voices.find((v) => v.id === voiceId);
    const hasMissingSelectedVoice = Boolean(voiceId) && !selectedVoice;
    const currentVoice = selectedVoice
        ? selectedVoice
        : hasMissingSelectedVoice
            ? {
                id: voiceId,
                name: "Unavaialable voice",
                category: null as null,
            }
            : voices[0];
    return (
        <Field>
            <FieldLabel>Voice Style</FieldLabel>
            <Select
                value={voiceId}
                onValueChange={(v) => form.setFieldValue("voiceId", v)}
                disabled={isSubmitting}
            >
                <SelectTrigger className="w-full h-auto gap-1 rounded-lg bg-white px-2 py-1">
                    <SelectValue>
                        {currentVoice && (
                            <>
                                <VoiceAvatar
                                    seed={currentVoice.id}
                                    name={currentVoice.name}
                                    className=""
                                />
                                <span className="truncate text-sm font-medium tracking-light">
                                    {currentVoice.name}
                                    {currentVoice.category && ` - ${VOICE_CATEGORY_LABELS[currentVoice.category]}`}
                                </span>
                            </>
                        )}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {hasMissingSelectedVoice && currentVoice && (
                        <>
                            <SelectGroup>
                                <SelectLabel>Select Voice</SelectLabel>
                                <SelectItem value={currentVoice.id}>
                                    <VoiceAvatar seed={currentVoice.id} name={currentVoice.name} />
                                    <span className="truncate text-sm font-medium">
                                        {currentVoice.name}
                                        {currentVoice.category && ` - ${VOICE_CATEGORY_LABELS[currentVoice.category]}`}
                                    </span>
                                </SelectItem>
                            </SelectGroup>
                            {(customVoices.length > 0 || systemVoices.length > 0) && (
                                <SelectSeparator />
                            )}
                        </>
                    )}
                    {customVoices.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Team Voices</SelectLabel>
                            {customVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                     <VoiceAvatar seed={voice.id} name={voice.name} />
                                     <span className="truncate text-sm font-medium">
                                        {voice.name} - {VOICE_CATEGORY_LABELS[voice.category]}
                                     </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                    {customVoices.length > 0 && systemVoices.length > 0 && (
                        <SelectSeparator />
                    )}
                    {systemVoices.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Built-in Voices</SelectLabel>
                            {systemVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                     <VoiceAvatar seed={voice.id} name={voice.name} />
                                     <span className="truncate text-sm font-medium">
                                        {voice.name} - {VOICE_CATEGORY_LABELS[voice.category]}
                                     </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                </SelectContent>
            </Select>
        </Field>
    );
};