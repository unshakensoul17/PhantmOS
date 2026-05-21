from fastembed import TextEmbedding
import numpy as np
import os

_model = None

def get_model():
    global _model
    if _model is None:
        cache_dir = os.path.join(os.getcwd(), "data", "fastembed_cache")
        os.makedirs(cache_dir, exist_ok=True)
        # fastembed runs on ONNX and CPU natively - much faster and no PyTorch!
        _model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2", cache_dir=cache_dir)
    return _model

def embed_text(text: str) -> list[float]:
    m = get_model()
    # fastembed returns a generator of numpy arrays
    embeddings = list(m.embed([text]))
    return embeddings[0].tolist()

def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

def score_match(master_text: str, jd_text: str) -> float:
    if not master_text or not jd_text:
        return 0.0
    v1 = embed_text(master_text)
    v2 = embed_text(jd_text)
    return cosine_similarity(v1, v2)
