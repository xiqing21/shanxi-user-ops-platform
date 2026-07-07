import math
import os
import time
from typing import Protocol

from .catalog import CATALOG_ASSETS, CatalogAsset
from .embeddings import HashEmbeddingModel
from .schemas import VectorSearchResult


class VectorStore(Protocol):
    backend: str

    def reindex(self) -> int:
        ...

    def search(self, query: str, top_k: int = 5) -> list[VectorSearchResult]:
        ...


class MemoryVectorStore:
    backend = "memory"

    def __init__(self, embedding_model: HashEmbeddingModel):
        self.embedding_model = embedding_model
        self.items: list[tuple[CatalogAsset, list[float]]] = []
        self.reindex()

    def reindex(self) -> int:
        self.items = [(asset, self.embedding_model.embed(asset.text)) for asset in CATALOG_ASSETS]
        return len(self.items)

    def search(self, query: str, top_k: int = 5) -> list[VectorSearchResult]:
        query_vector = self.embedding_model.embed(query)
        scored = [
            VectorSearchResult(
                name=asset.name,
                description=asset.description,
                score=cosine_similarity(query_vector, vector),
            )
            for asset, vector in self.items
        ]
        return sorted(scored, key=lambda item: item.score, reverse=True)[:top_k]


class MilvusVectorStore:
    backend = "milvus"

    def __init__(self, embedding_model: HashEmbeddingModel):
        self.embedding_model = embedding_model
        self.collection_name = os.getenv("MILVUS_COLLECTION", "shanxi_metadata_assets")
        self.dimension = embedding_model.dimension
        self._connect()
        self._ensure_collection()

    def _connect(self) -> None:
        from pymilvus import connections

        connections.connect(
            alias="default",
            host=os.getenv("MILVUS_HOST", "localhost"),
            port=os.getenv("MILVUS_PORT", "19530"),
        )

    def _ensure_collection(self) -> None:
        from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, utility

        if utility.has_collection(self.collection_name):
            utility.drop_collection(self.collection_name)

        schema = CollectionSchema(
            fields=[
                FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=128, is_primary=True),
                FieldSchema(name="name", dtype=DataType.VARCHAR, max_length=256),
                FieldSchema(name="description", dtype=DataType.VARCHAR, max_length=2048),
                FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=4096),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dimension),
            ],
            description="Shanxi electricity metadata assets for Text2SQL retrieval",
        )
        self.collection = Collection(self.collection_name, schema)
        self.collection.create_index(
            field_name="embedding",
            index_params={"metric_type": "IP", "index_type": "AUTOINDEX", "params": {}},
        )

    def reindex(self) -> int:
        rows = [
            [
                asset.name,
                asset.name,
                asset.description,
                asset.text,
                self.embedding_model.embed(asset.text),
            ]
            for asset in CATALOG_ASSETS
        ]
        if rows:
            columns = list(map(list, zip(*rows)))
            self.collection.insert(columns)
            self.collection.flush()
            self.collection.load()
        return len(rows)

    def search(self, query: str, top_k: int = 5) -> list[VectorSearchResult]:
        self.collection.load()
        results = self.collection.search(
            data=[self.embedding_model.embed(query)],
            anns_field="embedding",
            param={"metric_type": "IP", "params": {}},
            limit=top_k,
            output_fields=["name", "description"],
        )
        hits = []
        for hit in results[0]:
            hits.append(
                VectorSearchResult(
                    name=hit.entity.get("name"),
                    description=hit.entity.get("description"),
                    score=float(hit.score),
                )
            )
        return hits


def cosine_similarity(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right)) / ((norm(left) * norm(right)) or 1.0)


def norm(vector: list[float]) -> float:
    return math.sqrt(sum(value * value for value in vector))


def create_vector_store(embedding_model: HashEmbeddingModel) -> VectorStore:
    if os.getenv("VECTOR_BACKEND", "memory").lower() != "milvus":
        return MemoryVectorStore(embedding_model)

    retries = int(os.getenv("VECTOR_CONNECT_RETRIES", "20"))
    interval_seconds = float(os.getenv("VECTOR_CONNECT_INTERVAL_SECONDS", "2"))
    for _ in range(retries):
        try:
            store = MilvusVectorStore(embedding_model)
            store.reindex()
            return store
        except Exception:
            time.sleep(interval_seconds)

    return MemoryVectorStore(embedding_model)
