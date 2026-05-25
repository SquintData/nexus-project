"""Download Vosk Portuguese model for wake-word detection.
Run once: `python -m agent.setup_models`
"""
from __future__ import annotations

import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"
ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
TARGET = MODELS_DIR / "vosk-pt"


def main() -> int:
    if TARGET.exists() and any(TARGET.iterdir()):
        print(f"Model already at {TARGET}")
        return 0

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = MODELS_DIR / "vosk-pt.zip"

    print(f"Downloading {MODEL_URL} ...")
    with urllib.request.urlopen(MODEL_URL) as r, open(zip_path, "wb") as f:
        shutil.copyfileobj(r, f)

    print("Extracting ...")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(MODELS_DIR)

    # Folder inside zip is `vosk-model-small-pt-0.3` — rename to vosk-pt
    extracted = next(p for p in MODELS_DIR.iterdir() if p.is_dir() and p.name.startswith("vosk-model"))
    if extracted != TARGET:
        if TARGET.exists():
            shutil.rmtree(TARGET)
        extracted.rename(TARGET)

    zip_path.unlink(missing_ok=True)
    print(f"Done. Model at {TARGET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
