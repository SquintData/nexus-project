"""Record audio from a shared mic queue until VAD silence or timeout.

Queue-based design (instead of blocking stream.read) so KeyboardInterrupt
propagates promptly — Ctrl+C cleanly exits the agent.
"""
from __future__ import annotations

import queue
import time

import numpy as np

from agent.voice.vad import SileroVAD

VAD_CHUNK = 512  # silero requires EXACTLY 512 samples @ 16kHz


def _to_int16(chunk) -> np.ndarray:
    if isinstance(chunk, np.ndarray):
        return chunk.flatten().astype(np.int16, copy=False)
    return np.frombuffer(bytes(chunk), dtype=np.int16)


def record_until_silence(
    audio_q: "queue.Queue",
    vad: SileroVAD,
    timeout_seconds: float = 7.0,
) -> np.ndarray | None:
    """Pull chunks from `audio_q`; feed VAD in strict 512-sample blocks.
    Returns int16 ndarray or None on inactivity timeout.
    """
    buffer: list[np.ndarray] = []
    pending = np.empty((0,), dtype=np.int16)
    started = False
    start_wait = time.time()
    vad.reset()

    while True:
        try:
            chunk = audio_q.get(timeout=0.5)
        except queue.Empty:
            if not started and (time.time() - start_wait) > timeout_seconds:
                vad.reset()
                return None
            continue

        chunk_np = _to_int16(chunk)
        buffer.append(chunk_np)
        pending = np.concatenate([pending, chunk_np]) if pending.size else chunk_np

        while pending.size >= VAD_CHUNK:
            block = pending[:VAD_CHUNK]
            pending = pending[VAD_CHUNK:]
            event = vad.step(block)
            if event:
                if "start" in event and not started:
                    started = True
                if "end" in event and started:
                    vad.reset()
                    return np.concatenate(buffer, axis=0).flatten().astype(np.int16)

        if not started and (time.time() - start_wait) > timeout_seconds:
            vad.reset()
            return None
