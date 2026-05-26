"""Silero VAD via ONNX Runtime — voice start/end detection without torch.

Streams 512-sample int16 chunks at 16 kHz. Emits {'start': t} on speech onset
and {'end': t} after sustained silence (>= min_silence_ms once speech began).

Model file `silero_vad.onnx` is downloaded by `agent.setup_models` on first
install. Runs CPU-only — VAD inference is ~0.5ms per 32ms chunk.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import onnxruntime as ort

MODEL_PATH = Path(__file__).resolve().parent / "silero_vad.onnx"


class SileroVAD:
    def __init__(
        self,
        sample_rate: int = 16000,
        threshold: float = 0.5,
        min_silence_ms: int = 600,
    ):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"silero_vad.onnx not found at {MODEL_PATH}. "
                "Run `.venv\\Scripts\\python -m agent.setup_models` to download."
            )
        self.sample_rate = sample_rate
        self.threshold = threshold
        self.min_silence_samples = (sample_rate * min_silence_ms) // 1000

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(MODEL_PATH),
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )
        self._sr = np.array(sample_rate, dtype=np.int64)
        self.reset()

    def reset(self) -> None:
        self._state = np.zeros((2, 1, 128), dtype=np.float32)
        self._triggered = False
        self._silence_count = 0
        self._sample_pos = 0

    def step(self, chunk_int16: np.ndarray) -> dict | None:
        """Feed one chunk; returns {'start': t} or {'end': t} or None."""
        audio = chunk_int16.flatten().astype(np.float32) / 32768.0
        audio = audio.reshape(1, -1)

        prob, new_state = self.session.run(
            None,
            {"input": audio, "state": self._state, "sr": self._sr},
        )
        self._state = new_state
        p = float(prob[0, 0])

        n = audio.shape[1]
        self._sample_pos += n
        t = self._sample_pos / self.sample_rate

        if p >= self.threshold:
            self._silence_count = 0
            if not self._triggered:
                self._triggered = True
                return {"start": t}
        else:
            if self._triggered:
                self._silence_count += n
                if self._silence_count >= self.min_silence_samples:
                    self._triggered = False
                    self._silence_count = 0
                    return {"end": t}
        return None
