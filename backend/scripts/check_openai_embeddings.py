from __future__ import annotations

import math
import os
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ai_matching import embed_text  # noqa: E402


def main() -> None:
    if not os.getenv("OPENAI_API_KEY", "").strip():
        raise SystemExit(
            "OPENAI_API_KEY is not configured. Add it to backend/.env and try again."
        )

    vector, model = embed_text(
        "NUSphere OpenAI embedding check for mentor recommendation quality."
    )
    if model.startswith("local-hashing"):
        raise SystemExit(
            "OpenAI was configured but the local fallback was used. "
            "Check the backend log and API key, or set "
            "OPENAI_EMBEDDING_FALLBACK_ON_ERROR=false for a strict error."
        )

    magnitude = math.sqrt(sum(value * value for value in vector))
    print("OpenAI embeddings are working.")
    print(f"Model cache key: {model}")
    print(f"Vector dimensions: {len(vector)}")
    print(f"Normalized magnitude: {magnitude:.6f}")


if __name__ == "__main__":
    main()
