import hashlib
import math
import re


class HashEmbeddingModel:
    """Small deterministic embedding model for local demos and CI.

    It keeps the pipeline runnable without downloading a large model. Production
    can replace this class with BAAI/bge-m3 or another sentence-transformers model.
    """

    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        tokens = self._tokenize(text)
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]

    def _tokenize(self, text: str) -> list[str]:
        words = re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]", text.lower())
        return words or ["empty"]
