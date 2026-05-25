"""STT via Groq Whisper."""
from __future__ import annotations

import io
import wave

import numpy as np
from groq import Groq


class GroqSTT:
    def __init__(self, api_key: str, model: str = "whisper-large-v3-turbo"):
        self.client = Groq(api_key=api_key)
        self.model = model

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000, language: str = "pt") -> str:
        """Transcribe int16 mono PCM audio array to text."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sample_rate)
            w.writeframes(audio.tobytes())
        buf.seek(0)
        buf.name = "audio.wav"
        resp = self.client.audio.transcriptions.create(
            file=buf,
            model=self.model,
            language=language,
            response_format="text",
        )
        return resp.strip() if isinstance(resp, str) else str(resp).strip()
