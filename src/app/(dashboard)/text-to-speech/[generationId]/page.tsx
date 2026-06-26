import { TextToSpeechDetailView } from "@/feature/text-to-speech/views/text-to-speech-detail-view";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function TextToSpeechDetailPage({
    params,
}: { params: Promise<{ generationId: string }>}){
    const { generationId } = await params;

    prefetch(trpc.generations.getById.queryOptions({ id: generationId }));
    prefetch(trpc.voices.getAll.queryOptions());

    return (
        <HydrateClient>
            <TextToSpeechDetailView generationId={generationId} />
        </HydrateClient>
    )
}