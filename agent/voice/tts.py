"""TTS via OpenAI gpt-4o-mini-tts. Plays through default speakers."""
from __future__ import annotations

import io
import tempfile
import time
from pathlib import Path

from openai import OpenAI


class OpenAITTS:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini-tts", voice: str = "nova"):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.voice = voice

    def speak(self, text: str) -> None:
        if not text or not text.strip():
            return
        resp = self.client.audio.speech.create(
            model=self.model,
            voice=self.voice,
            input=text,
            response_format="mp3",
        )
        audio_bytes = resp.read() if hasattr(resp, "read") else resp.content
        # playsound needs a file path
        tmpdir = Path(tempfile.gettempdir())
        path = tmpdir / f"nexus_tts_{int(time.time()*1000)}.mp3"
        try:
            path.write_bytes(audio_bytes)
            try:
                from playsound import playsound
                playsound(str(path))
            except Exception:
                # Fallback: sounddevice + soundfile
                import sounddevice as sd
                import soundfile as sf
                data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
                sd.play(data, sr)
                sd.wait()
        finally:
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass
