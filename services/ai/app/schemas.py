from typing import Literal

from pydantic import BaseModel, Field


StepKind = Literal["semantic_parse", "metadata_retrieval", "clarify_metric", "generate_dws_ads"]


class TaskStep(BaseModel):
    kind: StepKind
    title: str
    detail: str


class AgentPlanRequest(BaseModel):
    query: str = Field(default="", min_length=0)


class AnalysisTaskPlan(BaseModel):
    intent: str
    needsNewWideTable: bool
    clarifyingQuestion: str
    candidateAssets: list[str]
    generatedSql: str
    steps: list[TaskStep]
    provider: str = "python-ai"
    model: str | None = None
    fallbackReason: str | None = None
    vectorBackend: str = "memory"
    retrievalMode: str = "vector"


class VectorSearchResult(BaseModel):
    name: str
    description: str
    score: float


class VectorSearchResponse(BaseModel):
    backend: str
    query: str
    results: list[VectorSearchResult]


class ReindexResponse(BaseModel):
    backend: str
    count: int
    collection: str
