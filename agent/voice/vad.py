"""Silero VAD: detects voice start/end to trim recording length."""
from __future__ import annotations

import numpy as np
import torch


class SileroVAD:
    def __init__(
        self,
        sample_rate: int = 16000,
        threshold: float = 0.5,
        min_silence_ms: int = 1500,
    ):
        self.sample_rate = sample_rate
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True,
            verbose=False,
        )
        VADIterator = utils[3]
        self.iterator = VADIterator(
            model,
            threshold=threshold,
            sampling_rate=sample_rate,
            min_silence_duration_ms=min_silence_ms,
        )

    def reset(self) -> None:
        self.iterator.reset_states()

    def step(self, chunk_int16: np.ndarray) -> dict | None:
        """Feed one chunk; returns {'start': t} or {'end': t} or None."""
        tensor = torch.from_numpy(chunk_int16.flatten().astype(np.float32) / 32768.0)
        return self.iterator(tensor, return_seconds=True)
