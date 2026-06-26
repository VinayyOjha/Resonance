import createClient from "openapi-fetch";
import type { paths } from "@/types/chatterbox-api";
import { env } from "./env";

//"createClient()" returns an object capable of making API requests
// Here, 'chatterbox' is the client who will communicate with our Chatterbox API with required api
export const chatterbox = createClient<paths>({
    baseUrl: env.CHATTERBOX_API_URL,
    headers: {
        "x-api-key": env.CHATTERBOX_API_KEY
    },
});

/*
After this file runs, chatterbox becomes a fully configured API client.
Instead of writing-
    fetch(
        "https://abc.modal.run/generate",
        {
            headers:{
                "x-api-key":"abc123"
            }
        }
    )

every time,
you simply write something like

    const response = await chatterbox.POST("/generate", {
        body: {
            prompt: "Hello",
            voice_key: "voices/system/default.wav"
        }
    });

The client automatically:

- Prepends the base URL (https://abc.modal.run).
- Adds the x-api-key header.
- Ensures the request body matches the OpenAPI schema using the generated paths type.
- Provides typed responses, so TypeScript knows exactly what the API returns.

*/