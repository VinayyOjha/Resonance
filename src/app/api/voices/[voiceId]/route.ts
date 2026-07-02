import { prisma } from "@/lib/db";
import { getSignedAudioUrl } from "@/lib/r2";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ voiceId: string}> },
){
    const { userId, orgId } = await auth();

    if (!userId || !orgId){
        return new Response("Unauthorized", { status: 401 });
    }

    const { voiceId } = await params;
    
    const voice = await prisma.voice.findUnique({
        where: { id: voiceId },
        select: {
            variant: true,
            orgId: true,
            r2ObjectKey: true,
        },
    });

    if (!voice) {
        return new Response("Not found", { status: 404 });
    }

    if (voice.variant === "CUSTOM" && voice.orgId !== orgId){
        return new Response("Not found", { status: 404 });
    }

    if (!voice.r2ObjectKey){
        return new Response("Voice audio is not available yet", { status: 409 });
    }

    const signedUrl = await getSignedAudioUrl(voice.r2ObjectKey);
    const audioResponse = await fetch(signedUrl);

    if (!audioResponse.ok){
        return new Response("Failed to fetch voice audio", { status: 502 });
    }

    const contentType = audioResponse.headers.get("content-type") || "audio/wav";

    return new Response(audioResponse.body, {
        headers: {
            "Content-Type": contentType,
            "Cache-Control": voice.variant === "CUSTOM" ? "private, max-age=3600" : "public, max-age=86400",
        },
    });
};