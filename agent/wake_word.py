"""Local wake-word detector via Vosk (offline). Chunk-fed; no stream ownership."""
from __future__ import annotations

import json
import os
from pathlib import Path

from vosk import KaldiRecognizer, Model, SetLogLevel

SetLogLevel(-1)
SAMPLE_RATE = 16000


class WakeWordDetector:
    """Stateless-ish wake detector. Feed PCM bytes via `feed()`; returns True on match.

    Privacy: All audio processed locally via Vosk. Nothing leaves machine.
    """

    NEXUS_VARIANTS = (
        "nexus", "néxus", "nesus", "nésus", "néx", "nex",
        "neku", "nekos", "necos", "anexo",
    )

    def __init__(self, model_path: str, wake_word: str = "ola nexus"):
        if not Path(model_path).exists():
            raise FileNotFoundError(
                f"Vosk model not found at {model_path}. "
                "Run `python -m agent.setup_models` to download."
            )
        self.model = Model(model_path)
        self.recognizer = KaldiRecognizer(self.model, SAMPLE_RATE)
        self.wake_word = wake_word.lower().strip()
        self.debug = os.getenv("WAKE_DEBUG", "0") == "1"
        self._last_printed = ""

    def reset(self) -> None:
        self.recognizer.Reset()
        self._last_printed = ""

    def feed(self, chunk_bytes: bytes) -> bool:
        if self.recognizer.AcceptWaveform(chunk_bytes):
            result = json.loads(self.recognizer.Result())
            text = result.get("text", "").lower()
            if self.debug and text:
                print(f"[heard] {text}")
                self._last_printed = text
        else:
            partial = json.loads(self.recognizer.PartialResult())
            text = partial.get("partial", "").lower()
            if self.debug and text and text != self._last_printed:
                print(f"[partial] {text}")
                self._last_printed = text
        return self._matches(text)

    def _matches(self, text: str) -> bool:
        if not text:
            return False
        norm = text.replace(",", "")
        if any(v in norm for v in self.NEXUS_VARIANTS):
            return True
        target_tokens = self.wake_word.replace(",", "").split()
        return all(tok in norm for tok in target_tokens)
