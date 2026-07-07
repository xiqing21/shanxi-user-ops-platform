from fastapi import FastAPI

from .embeddings import HashEmbeddingModel
from .planner import plan_with_deepseek
from .schemas import AgentPlanRequest, AnalysisTaskPlan, ReindexResponse, VectorSearchResponse
from .vector_store import create_vector_store


embedding_model = HashEmbeddingModel()
vector_store = create_vector_store(embedding_model)

app = FastAPI(title="Shanxi AI Text2SQL Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "service": "shanxi-ai", "vectorBackend": vector_store.backend}


@app.post("/vector/reindex", response_model=ReindexResponse)
def reindex() -> ReindexResponse:
    count = vector_store.reindex()
    collection = getattr(vector_store, "collection_name", "memory_catalog_assets")
    return ReindexResponse(backend=vector_store.backend, count=count, collection=collection)


@app.get("/vector/search", response_model=VectorSearchResponse)
def search(q: str, top_k: int = 5) -> VectorSearchResponse:
    results = vector_store.search(q, top_k)
    return VectorSearchResponse(backend=vector_store.backend, query=q, results=results)


@app.post("/agent/plan", response_model=AnalysisTaskPlan)
async def plan(request: AgentPlanRequest) -> AnalysisTaskPlan:
    assets = vector_store.search(request.query, top_k=5)
    result = await plan_with_deepseek(request.query, assets)
    result.vectorBackend = vector_store.backend
    result.retrievalMode = "milvus-vector" if vector_store.backend == "milvus" else "memory-vector"
    return result
