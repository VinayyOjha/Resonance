"""Chatterbox TTS API - Text-to-speech with voice cloning on Modal."""

import modal

# Use this to add R2 tokens:
# modal secret create cloudflare-r2 \
#   AWS_ACCESS_KEY_ID=<r2-access-key-id> \
#   AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>

# Use this to test locally:
# modal run chatterbox_tts.py \
#   --prompt "Hello from Chatterbox [chuckle]." \
#   --voice-key "voices/system/<voice-id>"

# Use this to test CURL:
# curl -X POST "https://<your-modal-endpoint>/generate" \
#   -H "Content-Type: application/json" \
#   -H "X-Api-Key: <your-api-key>" \
#   -d '{"prompt": "Hello from Chatterbox [chuckle].", "voice_key": "voices/system/<voice-id>"}' \
#   --output output.wav

# R2 cloud bucket mount (read-only, replaces Modal Volume)
R2_BUCKET_NAME = "resonance"
R2_ACCOUNT_ID = "fefb70762acf97f25a7b77069394e520"
R2_MOUNT_PATH = "/r2"
r2_bucket = modal.CloudBucketMount(
    R2_BUCKET_NAME,
    bucket_endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    secret=modal.Secret.from_name("cloudflare-r2"),
    read_only=True,
)

# Modal setup
image = modal.Image.debian_slim(python_version="3.10").uv_pip_install(
    "chatterbox-tts==0.1.6",
    "fastapi[standard]==0.124.4",
    "peft==0.18.0",
)
app = modal.App("chatterbox-tts", image=image)

with image.imports():
    import io
    import os
    from pathlib import Path

    import torchaudio as ta
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    from fastapi import (
        Depends,
        FastAPI,
        HTTPException,
        Security,
    )
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse
    from fastapi.security import APIKeyHeader
    from pydantic import BaseModel, Field

    api_key_scheme = APIKeyHeader(
        name="x-api-key",
        scheme_name="ApiKeyAuth",
        auto_error=False,
    )

    def verify_api_key(x_api_key: str | None = Security(api_key_scheme)):
        expected = os.environ.get("CHATTERBOX_API_KEY", "")
        if not expected or x_api_key != expected:
            raise HTTPException(status_code=403, detail="Invalid API key")
        return x_api_key

    class TTSRequest(BaseModel):
        """Request model for text-to-speech generation."""

        prompt: str = Field(..., min_length=1, max_length=5000)
        voice_key: str = Field(..., min_length=1, max_length=300)
        temperature: float = Field(default=0.8, ge=0.0, le=2.0)
        top_p: float = Field(default=0.95, ge=0.0, le=1.0)
        top_k: int = Field(default=1000, ge=1, le=10000)
        repetition_penalty: float = Field(default=1.2, ge=1.0, le=2.0)
        norm_loudness: bool = Field(default=True)


@app.cls(
    gpu="a10g",
    scaledown_window=60 * 5,
    secrets=[
        modal.Secret.from_name("hf-token"),
        modal.Secret.from_name("chatterbox-api-key"),
        modal.Secret.from_name("cloudflare-r2"),
    ],
    volumes={R2_MOUNT_PATH: r2_bucket},
)
@modal.concurrent(max_inputs=10)
class Chatterbox:
    @modal.enter()
    def load_model(self):
        self.model = ChatterboxTurboTTS.from_pretrained(device="cuda")

    @modal.asgi_app()
    def serve(self):
        web_app = FastAPI(
            title="Chatterbox TTS API",
            description="Text-to-speech with voice cloning",
            docs_url="/docs",
            dependencies=[Depends(verify_api_key)],
        )
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @web_app.post("/generate", responses={200: {"content": {"audio/wav": {}}}})
        def generate_speech(request: TTSRequest):
            voice_path = Path(R2_MOUNT_PATH) / request.voice_key
            if not voice_path.exists():
                raise HTTPException(
                    status_code=400,
                    detail=f"Voice not found at '{request.voice_key}'",
                )

            try:
                audio_bytes = self.generate.local(
                    request.prompt,
                    str(voice_path),
                    request.temperature,
                    request.top_p,
                    request.top_k,
                    request.repetition_penalty,
                    request.norm_loudness,
                )
                return StreamingResponse(
                    io.BytesIO(audio_bytes),
                    media_type="audio/wav",
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate audio: {e}",
                )

        return web_app

    @modal.method()
    def generate(
        self,
        prompt: str,
        audio_prompt_path: str,
        temperature: float = 0.8,
        top_p: float = 0.95,
        top_k: int = 1000,
        repetition_penalty: float = 1.2,
        norm_loudness: bool = True,
    ):
        wav = self.model.generate(
            prompt,
            audio_prompt_path=audio_prompt_path,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            repetition_penalty=repetition_penalty,
            norm_loudness=norm_loudness,
        )

        buffer = io.BytesIO()
        ta.save(buffer, wav, self.model.sr, format="wav")
        buffer.seek(0)
        return buffer.read()


@app.local_entrypoint()
def test(
    prompt: str = "Chatterbox running on Modal [chuckle].",
    voice_key: str = "voices/system/default.wav",
    output_path: str = "/tmp/chatterbox-tts/output.wav",
    temperature: float = 0.8,
    top_p: float = 0.95,
    top_k: int = 1000,
    repetition_penalty: float = 1.2,
    norm_loudness: bool = True,
):
    import pathlib

    chatterbox = Chatterbox()
    audio_prompt_path = f"{R2_MOUNT_PATH}/{voice_key}"
    audio_bytes = chatterbox.generate.remote(
        prompt=prompt,
        audio_prompt_path=audio_prompt_path,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        repetition_penalty=repetition_penalty,
        norm_loudness=norm_loudness,
    )

    output_file = pathlib.Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_bytes(audio_bytes)
    print(f"Audio saved to {output_file}")




# """Chatterbox TTS API - Text-to-speech with voice cloning on Modal."""

# # Local Machine
# #      ↓
# # Modal GPU
# #      ↓
# # Generate Audio
# #      ↓
# # Return Bytes
# #      ↓
# # Save output.wav

# # Use this to add R2 tokens:
# # modal secret create cloudflare-r2 \
# #   AWS_ACCESS_KEY_ID=e79bcbb09930916cccbca01305a4a36b \
# #   AWS_SECRET_ACCESS_KEY=168992177c56dd755d9e719f4af065e8c900e1772f9c592f3a4e5800ccc6fcb6

# # Use this to test locally:
# # modal run chatterbox_tts.py \
# #   --prompt "Hello from Chatterbox [chuckle]." \
# #   --voice-key "voices/system/<voice-id>"

# # Use this to test CURL:
# # curl -X POST "https://<your-modal-endpoint>/generate" \
# #   -H "Content-Type: application/json" \
# #   -H "X-Api-Key: <your-api-key>" \
# #   -d '{"prompt": "Hello from Chatterbox [chuckle].", "voice_key": "voices/system/<voice-id>"}' \
# #   --output output.wav
# import modal

# # ---------------------------------------------------------------------------
# # Cloudflare R2 Configuration
# # ---------------------------------------------------------------------------
# # Mount the Cloudflare R2 bucket inside the Modal container.
# # Files stored in this bucket can be accessed like local files under
# # R2_MOUNT_PATH. The mount is read-only because this application only
# # needs to read voice samples for voice cloning.
# # ---------------------------------------------------------------------------
# R2_BUCKET_NAME = "resonance"
# R2_ACCOUNT_ID = "fefb70762acf97f25a7b77069394e520"
# R2_MOUNT_PATH = "/r2"

# r2_bucket = modal.CloudBucketMount(
#     R2_BUCKET_NAME,
#     bucket_endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
#     secret=modal.Secret.from_name("cloudflare-r2"),
#     read_only=True,
# )

# # ---------------------------------------------------------------------------
# # Modal Runtime Image
# # ---------------------------------------------------------------------------
# # Define the runtime environment used by Modal.
# # Modal will create a container with Python 3.10 and install all
# # dependencies required for TTS generation and API serving.
# # ---------------------------------------------------------------------------
# image = modal.Image.debian_slim(python_version="3.10").uv_pip_install(
#     "chatterbox-tts==0.1.6",
#     "fastapi[standard]==0.124.4",
#     "peft==0.18.0",
# )

# # Create a Modal application named "chatterbox-tts".
# app = modal.App("chatterbox-tts", image=image)

# # ---------------------------------------------------------------------------
# # Container Imports
# # ---------------------------------------------------------------------------
# # Everything inside this block is imported inside the Modal container
# # environment rather than on the local machine.
# # ---------------------------------------------------------------------------
# with image.imports():
#     import io
#     import os
#     from pathlib import Path

#     import torchaudio as ta
#     from chatterbox.tts_turbo import ChatterboxTurboTTS
#     from fastapi import (
#         Depends,
#         FastAPI,
#         HTTPException,
#         Security,
#     )
#     from fastapi.middleware.cors import CORSMiddleware
#     from fastapi.responses import StreamingResponse
#     from fastapi.security import APIKeyHeader
#     from pydantic import BaseModel, Field

#     # -----------------------------------------------------------------------
#     # API Key Authentication Configuration
#     # -----------------------------------------------------------------------
#     # Define the HTTP header used to receive API keys from clients.
#     #
#     # Requests must include:
#     #     x-api-key: <api-key>
#     #
#     # Parameters:
#     # - name: Header name expected in incoming requests.
#     # - scheme_name: Display name shown in OpenAPI documentation.
#     # - auto_error: If False, missing headers return None instead of
#     #   automatically raising an exception.
#     # -----------------------------------------------------------------------
#     api_key_scheme = APIKeyHeader(
#         name="x-api-key",
#         scheme_name="ApiKeyAuth",
#         auto_error=False,
#     )

#     # -----------------------------------------------------------------------
#     # API Key Validation
#     # -----------------------------------------------------------------------
#     # Validate the API key provided by the client.
#     #
#     # The expected API key is loaded from the CHATTERBOX_API_KEY
#     # environment variable. Requests with missing or invalid keys
#     # are rejected with HTTP 403.
#     #
#     # Returns:
#     # - The validated API key.
#     #
#     # Raises:
#     # - HTTPException(403) when authentication fails.
#     # -----------------------------------------------------------------------
#     def verify_api_key(x_api_key: str | None = Security(api_key_scheme)):
#         expected = os.environ.get("CHATTERBOX_API_KEY", "")

#         if not expected or x_api_key != expected:
#             raise HTTPException(
#                 status_code=403,
#                 detail="Invalid API key"
#             )

#         return x_api_key

#     # -----------------------------------------------------------------------
#     # Request Schema
#     # -----------------------------------------------------------------------
#     # Defines the request body expected by the /generate endpoint.
#     #
#     # Fields:
#     # - prompt:
#     #     Text that should be converted into speech.
#     #
#     # - voice_key:
#     #     Relative path of the voice sample stored inside the R2 bucket.
#     #
#     # - temperature:
#     #     Controls randomness of generation.
#     #     Lower values produce more deterministic output.
#     #
#     # - top_p:
#     #     Nucleus sampling threshold.
#     #
#     # - top_k:
#     #     Limits the number of candidate tokens considered.
#     #
#     # - repetition_penalty:
#     #     Penalizes repetitive outputs.
#     #
#     # - norm_loudness:
#     #     Normalizes the output audio volume.
#     # -----------------------------------------------------------------------
#     class TTSRequest(BaseModel):
#         """Request model for text-to-speech generation."""

#         prompt: str = Field(..., min_length=1, max_length=5000)
#         voice_key: str = Field(..., min_length=1, max_length=300)
#         temperature: float = Field(default=0.8, ge=0.0, le=2.0)
#         top_p: float = Field(default=0.95, ge=0.0, le=1.0)
#         top_k: int = Field(default=1000, ge=1, le=10000)
#         repetition_penalty: float = Field(default=1.2, ge=1.0, le=2.0)
#         norm_loudness: bool = Field(default=True)

# # ---------------------------------------------------------------------------
# # Modal Worker Configuration
# # ---------------------------------------------------------------------------
# # Configure the Modal worker container.
# #
# # gpu:
# #     Use an NVIDIA A10G GPU for speech generation.
# #
# # scaledown_window:
# #     Keep the container alive for 5 minutes after the last request.
# #     This reduces cold starts for future requests.
# #
# # secrets:
# #     Inject API keys and credentials into the container.
# #
# # volumes:
# #     Mount the Cloudflare R2 bucket at /r2.
# # ---------------------------------------------------------------------------
# @app.cls(
#     gpu="a10g",
#     scaledown_window=60 * 5,
#     secrets=[
#         modal.Secret.from_name("hf-token"),
#         modal.Secret.from_name("chatterbox-api-key"),
#         modal.Secret.from_name("cloudflare-r2"),
#     ],
#     volumes={R2_MOUNT_PATH: r2_bucket},
# )

# # ---------------------------------------------------------------------------
# # Concurrency Configuration
# # ---------------------------------------------------------------------------
# # Allow up to 10 requests to be processed concurrently by the
# # same Modal container.
# # ---------------------------------------------------------------------------
# @modal.concurrent(max_inputs=10)
# class Chatterbox:

#     # -----------------------------------------------------------------------
#     # Model Initialization
#     # -----------------------------------------------------------------------
#     # Load the Chatterbox model into GPU memory when the container starts.
#     # This method runs once per container lifecycle and avoids reloading
#     # the model for every incoming request.
#     # -----------------------------------------------------------------------
#     @modal.enter()
#     def load_model(self):
#         self.model = ChatterboxTurboTTS.from_pretrained(device="cuda")

#     # -----------------------------------------------------------------------
#     # FastAPI Application
#     # -----------------------------------------------------------------------
#     # Create and configure the FastAPI application that serves the API.
#     #
#     # title:
#     #     Display name shown in Swagger/OpenAPI documentation.
#     #
#     # description:
#     #     Short description displayed in API docs.
#     #
#     # docs_url:
#     #     Route where Swagger UI is exposed.
#     #
#     # dependencies:
#     #     Global dependencies executed before every endpoint.
#     #     Used here to enforce API key authentication.
#     # -----------------------------------------------------------------------
#     @modal.asgi_app()
#     def serve(self):
#         web_app = FastAPI(
#             title="Chatterbox TTS API",
#             description="Text-to-speech with voice cloning",
#             docs_url="/docs",
#             dependencies=[Depends(verify_api_key)],
#         )

#         # -------------------------------------------------------------------
#         # CORS Configuration
#         # -------------------------------------------------------------------
#         # Configure Cross-Origin Resource Sharing (CORS).
#         # This allows browser-based clients from other domains
#         # to access the API.
#         # -------------------------------------------------------------------
#         web_app.add_middleware(
#             CORSMiddleware,
#             allow_origins=["*"],
#             allow_credentials=True,
#             allow_methods=["*"],
#             allow_headers=["*"],
#         )

#         # -------------------------------------------------------------------
#         # Speech Generation Endpoint
#         # -------------------------------------------------------------------
#         # Generate speech using the supplied text and reference voice.
#         #
#         # Workflow:
#         # 1. Locate the requested voice sample in the mounted R2 bucket.
#         # 2. Verify that the voice sample exists.
#         # 3. Generate speech using the Chatterbox model.
#         # 4. Return the generated audio as a WAV stream.
#         # -------------------------------------------------------------------
#         @web_app.post(
#             "/generate",
#             responses={200: {"content": {"audio/wav": {}}}}
#         )
#         def generate_speech(request: TTSRequest):

#             # Construct the absolute path to the requested voice sample.
#             voice_path = Path(R2_MOUNT_PATH) / request.voice_key

#             # Ensure the requested voice file exists before generation.
#             if not voice_path.exists():
#                 raise HTTPException(
#                     status_code=400,
#                     detail=f"Voice not found at '{request.voice_key}'",
#                 )

#             try:
#                 # Execute speech generation using the loaded model.
#                 # The .local() call runs the Modal method inside the
#                 # current container.
#                 audio_bytes = self.generate.local(
#                     request.prompt,
#                     str(voice_path),
#                     request.temperature,
#                     request.top_p,
#                     request.top_k,
#                     request.repetition_penalty,
#                     request.norm_loudness,
#                 )

#                 # Stream the generated WAV bytes back to the client.
#                 return StreamingResponse(
#                     io.BytesIO(audio_bytes),
#                     media_type="audio/wav",
#                 )

#             except Exception as e:
#                 raise HTTPException(
#                     status_code=500,
#                     detail=f"Failed to generate audio: {e}",
#                 )

#         return web_app

#     # -----------------------------------------------------------------------
#     # Core Speech Generation
#     # -----------------------------------------------------------------------
#     # Generate speech audio using the loaded Chatterbox model.
#     #
#     # Parameters:
#     # - prompt:
#     #     Text to synthesize into speech.
#     #
#     # - audio_prompt_path:
#     #     Path to the reference voice sample.
#     #
#     # - temperature:
#     #     Controls randomness during generation.
#     #
#     # - top_p:
#     #     Nucleus sampling threshold.
#     #
#     # - top_k:
#     #     Maximum number of candidate tokens considered.
#     #
#     # - repetition_penalty:
#     #     Penalizes repeated outputs.
#     #
#     # - norm_loudness:
#     #     Applies loudness normalization.
#     #
#     # Returns:
#     # - WAV audio bytes.
#     # -----------------------------------------------------------------------
#     @modal.method()
#     def generate(
#         self,
#         prompt: str,
#         audio_prompt_path: str,
#         temperature: float = 0.8,
#         top_p: float = 0.95,
#         top_k: int = 1000,
#         repetition_penalty: float = 1.2,
#         norm_loudness: bool = True,
#     ):
#         # Generate an audio waveform tensor from the input text
#         # using the provided reference voice sample.
#         wav = self.model.generate(
#             prompt,
#             audio_prompt_path=audio_prompt_path,
#             temperature=temperature,
#             top_p=top_p,
#             top_k=top_k,
#             repetition_penalty=repetition_penalty,
#             norm_loudness=norm_loudness,
#         )

#         # Create an in-memory buffer to avoid writing temporary files.
#         buffer = io.BytesIO()

#         # Serialize the waveform tensor into WAV format and write
#         # it into the in-memory buffer.
#         ta.save(
#             buffer,
#             wav,
#             self.model.sr,
#             format="wav"
#         )

#         # Move the cursor to the beginning of the buffer so it can
#         # be read correctly.
#         buffer.seek(0)

#         # Return the generated WAV file as raw bytes.
#         return buffer.read()

# # ---------------------------------------------------------------------------
# # Local Testing Entrypoint
# # ---------------------------------------------------------------------------
# # Allows the application to be executed locally using:
# #
# #     modal run chatterbox_tts.py
# #
# # Generates speech using the supplied prompt and voice sample,
# # then saves the resulting audio file to disk.
# # ---------------------------------------------------------------------------
# @app.local_entrypoint()
# def test(
#     prompt: str = "Chatterbox running on Modal [chuckle].",
#     voice_key: str = "voices/system/default.wav",
#     output_path: str = "/tmp/chatterbox-tts/output.wav",
#     temperature: float = 0.8,
#     top_p: float = 0.95,
#     top_k: int = 1000,
#     repetition_penalty: float = 1.2,
#     norm_loudness: bool = True,
# ):
#     import pathlib

#     chatterbox = Chatterbox()

#     # Construct the full path to the reference voice sample.
#     audio_prompt_path = f"{R2_MOUNT_PATH}/{voice_key}"

#     # Execute speech generation remotely on the Modal worker.
#     audio_bytes = chatterbox.generate.remote(
#         prompt=prompt,
#         audio_prompt_path=audio_prompt_path,
#         temperature=temperature,
#         top_p=top_p,
#         top_k=top_k,
#         repetition_penalty=repetition_penalty,
#         norm_loudness=norm_loudness,
#     )

#     # Create the output directory if it does not already exist.
#     output_file = pathlib.Path(output_path)
#     output_file.parent.mkdir(parents=True, exist_ok=True)

#     # Save the generated audio to disk.
#     output_file.write_bytes(audio_bytes)

#     print(f"Audio saved to {output_file}")

