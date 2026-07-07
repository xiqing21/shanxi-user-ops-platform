export interface TaskStep {
  kind: "semantic_parse" | "metadata_retrieval" | "clarify_metric" | "generate_dws_ads";
  title: string;
  detail: string;
}

export interface AnalysisTaskPlan {
  intent: string;
  needsNewWideTable: boolean;
  clarifyingQuestion: string;
  candidateAssets: string[];
  generatedSql: string;
  steps: TaskStep[];
}
