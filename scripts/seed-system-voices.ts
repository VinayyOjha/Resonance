// What does this file do
/*

For each system voice:

Aaron.wav
Abigail.wav
Anaya.wav
...

↓

Read audio file

↓

Check database:
  Does voice already exist?

  YES:
      Upload new audio
      Update metadata

  NO:
      Create DB record
      Upload audio
      Save R2 object key

*/

import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import {
    PutObjectCommand,
    S3Client,
    type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

import {
    PrismaClient,
    type VoiceCategory,
} from "../src/generated/prisma/client";

// List of voices
import { CANONICAL_SYSTEM_VOICE_NAMES } from "../src/feature/voices/data/voice-scoping";

/**
 * Step-1: import.meta.url
 *      - eg: file:///project/scripts/seed-system-voices.ts
 * 
 * Step-2: fileURLToPath(...)
 *      - converts above path to /project/scripts/seed-system-voices.ts
 * 
 * Step-3: path.dirname(...)
 *      - Gets: /project/scripts
 */
const SYSTEM_VOICES_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "system-voices",
);

// Runtime validation
const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
});

const env = envSchema.parse(process.env);

// Database setup
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Cloudflare R2 setup
const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
});

// Defines the structure of metadat of voices
interface VoiceMetadata {
    description: string;
    category: VoiceCategory;
    language: string;
}

// Maps voice name to metadata 
// EG: const meta = systemVoiceMetadata["Aaron"]; returns -> metadata for 'Aaron'
const systemVoiceMetadata: Record<string, VoiceMetadata> = {
    Aaron: {
        description: "Soothing and calm, like a self-help audiobook narrator",
        category: "AUDIOBOOK",
        language: "en-US",
    },
    Abigail: {
        description: "Friendly and conversational with a warm, approachable tone",
        category: "CONVERSATIONAL",
        language: "en-GB",
    },
    Anaya: {
        description: "Polite and professional, suited for customer service",
        category: "CUSTOMER_SERVICE",
        language: "en-IN",
    },
    Andy: {
        description: "Versatile and clear, a reliable all-purpose narrator",
        category: "GENERAL",
        language: "en-US",
    },
    Archer: {
        description: "Laid-back and reflective with a steady, storytelling pace",
        category: "NARRATIVE",
        language: "en-US",
    },
    Brian: {
        description: "Professional and helpful with a clear customer support tone",
        category: "CUSTOMER_SERVICE",
        language: "en-US",
    },
    Chloe: {
        description: "Bright and bubbly with a cheerful, outgoing personality",
        category: "CORPORATE",
        language: "en-AU",
    },
    Dylan: {
        description:
            "Thoughtful and intimate, like a quiet late-night conversation",
        category: "GENERAL",
        language: "en-US",
    },
    Emmanuel: {
        description: "Nasally and distinctive with a quirky, cartoon-like quality",
        category: "CHARACTER",
        language: "en-US",
    },
    Ethan: {
        description: "Polished and warm with crisp, studio-quality delivery",
        category: "VOICEOVER",
        language: "en-US",
    },
    Evelyn: {
        description: "Warm Southern charm with a heartfelt, down-to-earth feel",
        category: "CONVERSATIONAL",
        language: "en-US",
    },
    Gavin: {
        description: "Calm and reassuring with a smooth, natural flow",
        category: "MEDITATION",
        language: "en-US",
    },
    Gordon: {
        description: "Warm and encouraging with an uplifting, motivational tone",
        category: "MOTIVATIONAL",
        language: "en-US",
    },
    Ivan: {
        description: "Deep and cinematic with a dramatic, movie-character presence",
        category: "CHARACTER",
        language: "ru-RU",
    },
    Laura: {
        description: "Authentic and warm with a conversational Midwestern tone",
        category: "CONVERSATIONAL",
        language: "en-US",
    },
    Lucy: {
        description: "Direct and composed with a professional phone manner",
        category: "CUSTOMER_SERVICE",
        language: "en-US",
    },
    Madison: {
        description: "Energetic and unfiltered with a casual, chatty vibe",
        category: "PODCAST",
        language: "en-US",
    },
    Marisol: {
        description: "Confident and polished with a persuasive, ad-ready delivery",
        category: "ADVERTISING",
        language: "en-US",
    },
    Meera: {
        description: "Friendly and helpful with a clear, service-oriented tone",
        category: "CUSTOMER_SERVICE",
        language: "en-IN",
    },
    Walter: {
        description: "Old and raspy with deep gravitas, like a wise grandfather",
        category: "NARRATIVE",
        language: "en-US",
    },
};

// Purpose: Load Aaron.wav
async function readSystemVoiceAudio(name: string) {

    // Build filepath: for Aaron: system-voices/Aaron.wav
    const filePath = path.join(SYSTEM_VOICES_DIR, `${name}.wav`);

    // 1. Read the file(say Aaron.wav) which return a buffer or binary data  -> 2. Buffer.from(...) Allocates a new Buffer using an array of bytes in the range 0 – 255
    const buffer = Buffer.from(await fs.readFile(filePath));
    return { buffer, contentType: "audio/wav" };
}

// Uploads audio to R2
async function uploadSystemVoiceAudio({
    key,
    buffer,
    contentType,
}: {
    key: string;
    buffer: Buffer;
    contentType: string;
}) {
    // Create the command
    const commandInput: PutObjectCommandInput = {
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    };

    // PUT file into the bucket
    await r2.send(new PutObjectCommand(commandInput));
}

// CORE FUNCTION
async function seedSystemVoice(name: string) {
    // 1. Read the audio and get the .wav file
    const { buffer, contentType } = await readSystemVoiceAudio(name);

    // Check if the voice exists
    // Returns id or null
    const existingSystemVoice = await prisma.voice.findFirst({
        where: {
            variant: "SYSTEM",
            name,
        },
        select: { id: true },
    });

    // If voice exists
    if (existingSystemVoice) {
        // 1. Create R2 Key
        const r2ObjectKey = `voices/system/${existingSystemVoice.id}`;

        // 2. Get metadata
        const meta = systemVoiceMetadata[name];

        // 3. Upload the audio
        await uploadSystemVoiceAudio({
            key: r2ObjectKey,
            buffer,
            contentType,
        });
        
        // Update the db with the R2 key and VoiceMetadata(meta)
        await prisma.voice.update({
            where: { id: existingSystemVoice.id },
            data: {
                r2ObjectKey,
                // if meta exists include these files
                ...(meta && {
                    description: meta.description,
                    category: meta.category,
                    language: meta.language,
                }),
            },
        });
        return;
    }

    // NO EXISTING VOICE FOUND
    // 1. Get metadata
    const meta = systemVoiceMetadata[name];

    // 2. Create DB record
    // WHY? Because system voice belong to nobody
    const voice = await prisma.voice.create({
        data: {
            name,
            variant: "SYSTEM",
            orgId: null,
            ...(meta && {
                description: meta.description,
                category: meta.category,
                language: meta.language,
            }),
        },
        select: {
            id: true,
        },
    });

    // Create a R2 key
    const r2ObjectKey = `voices/system/${voice.id}`;

    // Try to upload bc uploads can fail
    try {
        await uploadSystemVoiceAudio({
            key: r2ObjectKey,
            buffer,
            contentType,
        });

        // Save the key to DB
        // Why not save before? Bc if upload fails then db would point to non-existent file
        await prisma.voice.update({
            where: {
                id: voice.id,
            },
            data: {
                r2ObjectKey,
            },
        });
    }
    // If upload fails: ROLLBACK
    catch (error) {

        // Remove the bad record. This is a rollback
        await prisma.voice
            .delete({
                where: {
                    id: voice.id,
                },
            })
            .catch(() => { });

        throw error;
    }
};

async function main() {
    console.log(
        `Seeding ${CANONICAL_SYSTEM_VOICE_NAMES.length} system voices...`,
    );

    for (const name of CANONICAL_SYSTEM_VOICE_NAMES) {
        console.log(`- ${name}`);
        await seedSystemVoice(name);
    }

    console.log("System voice seed completed.");
}

main()
    .catch((error) => {
        console.error("Failed to seed system voices:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });