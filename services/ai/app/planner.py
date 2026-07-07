import json
import os
from typing import Any

import httpx
from pydantic import ValidationError

from .schemas import AnalysisTaskPlan, TaskStep, VectorSearchResult


REQUIRED_STEPS = [
    TaskStep(kind="semantic_parse", title="语义拆解", detail="识别查询对象、时间范围、统计口径和输出维度。"),
    TaskStep(kind="metadata_retrieval", title="元数据检索", detail="从向量库召回 DWD/DWS/ADS 表、字段、标签和版本描述。"),
    TaskStep(kind="clarify_metric", title="口径确认", detail="缺少宽表或指标不明确时，进入多轮交互补齐阈值、粒度和时段。"),
    TaskStep(kind="generate_dws_ads", title="生成任务", detail="生成实时 SQL、离线批任务校验和 ADS 接口表设计。"),
]


def fallback_plan(query: str, assets: list[VectorSearchResult], reason: str | None = None) -> AnalysisTaskPlan:
    industrial_spike = "大工业" in query and "突增" in query
    return AnalysisTaskPlan(
        intent="industrial_peak_spike_ranking" if industrial_spike else "general_text_to_sql",
        needsNewWideTable=industrial_spike,
        clarifyingQuestion=(
            "突增建议按昨日同小时环比超过30%，还是近7日均值超过2倍？晚高峰按18:00-22:00还是自定义时段？"
            if industrial_spike
            else "请确认查询时间范围、统计粒度，以及是否允许新建离线校验宽表。"
        ),
        candidateAssets=[asset.name for asset in assets],
        generatedSql="\n".join(
            [
                "CREATE TABLE ads_industrial_peak_spike_rank AS",
                "SELECT city, industry, user_id, MAX(spike_ratio) AS max_spike_ratio",
                "FROM dws_user_hourly_load_baseline",
                "WHERE user_type = 'large_industrial' AND hour(stat_hour) BETWEEN 18 AND 22",
                "GROUP BY city, industry, user_id;",
            ]
        ),
        steps=REQUIRED_STEPS,
        provider="python-ai",
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        fallbackReason=reason,
    )


async def plan_with_deepseek(query: str, assets: list[VectorSearchResult]) -> AnalysisTaskPlan:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return fallback_plan(query, assets, "未配置 DEEPSEEK_API_KEY，Python AI 使用本地规划器。")

    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

    prompt_assets = "\n".join([f"- {asset.name}: {asset.description}" for asset in assets])
    messages = [
        {
            "role": "system",
            "content": "\n".join(
                [
                    "你是山西省全量用电用户实时运营平台的 Text2SQL 与 AI 建任务智能体。",
                    "你必须结合向量检索到的表资产，输出可以被前端渲染和后续任务系统执行的严格 json。",
                    "如果现有宽表无法回答，要说明需要新建 DWS/ADS 宽表，并体现实时任务与离线批校验的关系。",
                    "steps 必须覆盖 semantic_parse, metadata_retrieval, clarify_metric, generate_dws_ads 四类步骤。",
                    "只输出 json，不要 markdown。",
                ]
            ),
        },
        {
            "role": "user",
            "content": f"用户需求：{query}\n向量召回资产：\n{prompt_assets}\n请输出 AnalysisTaskPlan json。",
        },
    ]

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"authorization": f"Bearer {api_key}", "content-type": "application/json"},
                json={
                    "model": model,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 1800,
                    "stream": False,
                },
            )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        plan = coerce_deepseek_plan(content, query, assets, model)
        return complete_plan(plan, assets, model)
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, ValidationError, ValueError):
        return fallback_plan(query, assets, "DeepSeek 暂不可用或返回结构不完整，Python AI 使用本地规划器。")


def coerce_deepseek_plan(content: str, query: str, assets: list[VectorSearchResult], model: str) -> AnalysisTaskPlan:
    try:
        return AnalysisTaskPlan.model_validate_json(content)
    except ValidationError:
        payload = json.loads(content)

    if not isinstance(payload, dict):
        raise ValueError("DeepSeek JSON content must be an object")

    steps = coerce_steps(payload.get("steps"))
    conclusion = str(payload.get("conclusion") or payload.get("summary") or "")
    needs_new_wide_table = infer_needs_new_wide_table(payload, conclusion, query)

    return AnalysisTaskPlan(
        intent=str(payload.get("intent") or infer_intent(query)),
        needsNewWideTable=needs_new_wide_table,
        clarifyingQuestion=str(
            payload.get("clarifyingQuestion")
            or payload.get("clarifying_question")
            or infer_clarifying_question(needs_new_wide_table)
        ),
        candidateAssets=coerce_candidate_assets(payload, assets),
        generatedSql=str(payload.get("generatedSql") or payload.get("generated_sql") or infer_sql(needs_new_wide_table)),
        steps=steps,
        provider="python-ai",
        model=model,
    )


def coerce_steps(raw_steps: Any) -> list[TaskStep]:
    if not isinstance(raw_steps, list):
        return REQUIRED_STEPS

    by_kind: dict[str, TaskStep] = {}
    for raw_step in raw_steps:
        if not isinstance(raw_step, dict):
            continue
        kind = str(raw_step.get("kind") or raw_step.get("step") or "")
        if kind not in {step.kind for step in REQUIRED_STEPS}:
            continue
        by_kind[kind] = TaskStep(
            kind=kind,  # type: ignore[arg-type]
            title=str(raw_step.get("title") or title_for_step(kind)),
            detail=str(raw_step.get("detail") or raw_step.get("description") or ""),
        )

    return [by_kind.get(step.kind, step) for step in REQUIRED_STEPS]


def title_for_step(kind: str) -> str:
    return next((step.title for step in REQUIRED_STEPS if step.kind == kind), kind)


def coerce_candidate_assets(payload: dict[str, Any], assets: list[VectorSearchResult]) -> list[str]:
    raw_assets = payload.get("candidateAssets") or payload.get("candidate_assets")
    if isinstance(raw_assets, list):
        names = [asset for asset in raw_assets if isinstance(asset, str)]
        if names:
            return names
    return [asset.name for asset in assets]


def infer_intent(query: str) -> str:
    if "大工业" in query and ("突增" in query or "峰" in query):
        return "industrial_peak_spike_ranking"
    return "general_text_to_sql"


def infer_needs_new_wide_table(payload: dict[str, Any], conclusion: str, query: str) -> bool:
    explicit = payload.get("needsNewWideTable")
    if isinstance(explicit, bool):
        return explicit
    explicit = payload.get("needs_new_wide_table")
    if isinstance(explicit, bool):
        return explicit
    if "无需新建" in conclusion or "不需要新建" in conclusion:
        return False
    if "需要新建" in conclusion:
        return True
    return "大工业" in query and "突增" in query


def infer_clarifying_question(needs_new_wide_table: bool) -> str:
    if needs_new_wide_table:
        return "请确认突增阈值、晚高峰时段、TopN 排名粒度，以及是否需要离线批任务每日校验。"
    return "请确认现有接口表是否覆盖近7天数据、突增计算口径和排序字段。"


def infer_sql(needs_new_wide_table: bool) -> str:
    if needs_new_wide_table:
        return fallback_plan("", [], None).generatedSql

    return "\n".join(
        [
            "SELECT city, industry, user_id, max_spike_ratio, rank_no",
            "FROM ads_industrial_peak_spike_rank",
            "WHERE ds >= CURRENT_DATE - INTERVAL '7' DAY",
            "ORDER BY rank_no",
            "LIMIT 10;",
        ]
    )


def complete_plan(plan: AnalysisTaskPlan, assets: list[VectorSearchResult], model: str) -> AnalysisTaskPlan:
    by_kind = {step.kind: step for step in plan.steps}
    plan.steps = [by_kind.get(step.kind, step) for step in REQUIRED_STEPS]
    if not plan.candidateAssets:
        plan.candidateAssets = [asset.name for asset in assets]
    plan.provider = "python-ai"
    plan.model = model
    return plan
