from fastapi.testclient import TestClient

from app.main import app
from app.planner import coerce_deepseek_plan
from app.schemas import VectorSearchResult


client = TestClient(app)


def test_health_reports_vector_backend():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["service"] == "shanxi-ai"
    assert response.json()["vectorBackend"] in {"memory", "milvus"}


def test_vector_search_returns_catalog_assets():
    response = client.get("/vector/search", params={"q": "大工业 晚高峰 突增", "top_k": 3})

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"]
    assert payload["backend"] in {"memory", "milvus"}


def test_agent_plan_works_without_deepseek_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    response = client.post("/agent/plan", json={"query": "分析近30天山西大工业用户晚高峰负荷突增，并按行业和地市排名"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "python-ai"
    assert payload["intent"] == "industrial_peak_spike_ranking"
    assert payload["needsNewWideTable"] is True
    assert [step["kind"] for step in payload["steps"]] == [
        "semantic_parse",
        "metadata_retrieval",
        "clarify_metric",
        "generate_dws_ads",
    ]


def test_coerces_deepseek_alternate_json_shape():
    content = """
    {
      "analysis_type": "text2sql_and_ai_task_building",
      "steps": [
        {"step": "semantic_parse", "description": "解析用户需求。"},
        {"step": "metadata_retrieval", "description": "检索向量召回资产。"}
      ],
      "conclusion": "不需要新建宽表，现有ads_industrial_peak_spike_rank表已满足。"
    }
    """
    plan = coerce_deepseek_plan(
        content,
        "统计山西省近7天大工业用户晚高峰负荷突增Top10",
        [
            VectorSearchResult(
                name="ads_industrial_peak_spike_rank",
                description="大工业用户晚高峰负荷突增排名接口表",
                score=0.9,
            )
        ],
        "deepseek-v4-flash",
    )

    assert plan.intent == "industrial_peak_spike_ranking"
    assert plan.needsNewWideTable is False
    assert plan.candidateAssets == ["ads_industrial_peak_spike_rank"]
    assert [step.kind for step in plan.steps] == [
        "semantic_parse",
        "metadata_retrieval",
        "clarify_metric",
        "generate_dws_ads",
    ]
