"""Download Vosk PT (wake word) + Silero VAD ONNX (voice activity) models.
Run once: `python -m agent.setup_models`
"""
from __future__ import annotations

import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

VOSK_URL = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"
SILERO_URL = "https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad_half.onnx"

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
VOSK_TARGET = MODELS_DIR / "vosk-pt"
SILERO_TARGET = ROOT / "voice" / "silero_vad.onnx"


def _download_vosk() -> None:
    if VOSK_TARGET.exists() and any(VOSK_TARGET.iterdir()):
        print(f"[vosk] already at {VOSK_TARGET}")
        return

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = MODELS_DIR / "vosk-pt.zip"

    print(f"[vosk] downloading {VOSK_URL} ...")
    with urllib.request.urlopen(VOSK_URL) as r, open(zip_path, "wb") as f:
        shutil.copyfileobj(r, f)

    print("[vosk] extracting ...")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(MODELS_DIR)

    extracted = next(p for p in MODELS_DIR.iterdir() if p.is_dir() and p.name.startswith("vosk-model"))
    if extracted != VOSK_TARGET:
        if VOSK_TARGET.exists():
            shutil.rmtree(VOSK_TARGET)
        extracted.rename(VOSK_TARGET)

    zip_path.unlink(missing_ok=True)
    print(f"[vosk] done. {VOSK_TARGET}")


def _download_silero() -> None:
    if SILERO_TARGET.exists():
        print(f"[silero] already at {SILERO_TARGET}")
        return

    SILERO_TARGET.parent.mkdir(parents=True, exist_ok=True)
    print(f"[silero] downloading {SILERO_URL} ...")
    with urllib.request.urlopen(SILERO_URL) as r, open(SILERO_TARGET, "wb") as f:
        shutil.copyfileobj(r, f)
    print(f"[silero] done. {SILERO_TARGET}")


def main() -> int:
    _download_vosk()
    _download_silero()
    return 0


if __name__ == "__main__":
    sys.exit(main())
