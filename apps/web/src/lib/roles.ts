import type { LucideIcon } from "lucide-react";
import { Bot, Building2, Factory, RadioTower } from "lucide-react";

export type RoleId = "province_dispatch" | "city_operator" | "industrial_specialist" | "ai_ops";

export interface RoleView {
  id: RoleId;
  name: string;
  shortName: string;
  icon: LucideIcon;
  scopeLabel: string;
  defaultTab: string;
  visibleTabs: string[];
  cities: string[];
  riskFilter: "all" | "city" | "industrial" | "ai";
  defaultTextToSqlQuery: string;
  defaultAgentQuery: string;
  operatingHint: string;
}

export const roles: RoleView[] = [
  {
    id: "province_dispatch",
    name: "省调运营负责人",
    shortName: "省调",
    icon: RadioTower,
    scopeLabel: "山西省全量用户",
    defaultTab: "全省态势",
    visibleTabs: ["全省态势", "大工业分析", "AI 问数", "AI 建任务", "多Agent编排", "模拟压测"],
    cities: ["太原", "大同", "长治", "运城", "临汾", "吕梁", "晋中", "忻州"],
    riskFilter: "all",
    defaultTextToSqlQuery: "统计山西省近7天各地市实时风险数量、严重风险数量和大工业用户占比",
    defaultAgentQuery: "统计山西省近7天大工业用户晚高峰负荷突增Top10，并说明是否需要新建宽表",
    operatingHint: "关注全省态势、地市风险分布和实时/离线校准一致性。"
  },
  {
    id: "city_operator",
    name: "市县公司运维人员",
    shortName: "市县",
    icon: Building2,
    scopeLabel: "太原市运维视角",
    defaultTab: "全省态势",
    visibleTabs: ["全省态势", "AI 问数", "多Agent编排", "模拟压测"],
    cities: ["太原", "晋中", "忻州", "吕梁"],
    riskFilter: "city",
    defaultTextToSqlQuery: "查询太原市今日低功率因数、三相不平衡和过载用户清单，按台区聚合",
    defaultAgentQuery: "为太原市市县运维生成低功率因数和三相不平衡的日巡检任务，并给出处置优先级",
    operatingHint: "关注本区域异常用户、台区、线路，以及是否需要派发工单。"
  },
  {
    id: "industrial_specialist",
    name: "大工业客户专员",
    shortName: "大工业",
    icon: Factory,
    scopeLabel: "大工业与高耗能用户",
    defaultTab: "大工业分析",
    visibleTabs: ["大工业分析", "全省态势", "AI 问数", "AI 建任务", "多Agent编排"],
    cities: ["太原", "大同", "长治", "运城", "临汾", "吕梁", "晋中", "忻州"],
    riskFilter: "industrial",
    defaultTextToSqlQuery: "查询近30天山西大工业和高耗能用户晚高峰负荷突增Top20，按行业排名",
    defaultAgentQuery: "分析近30天山西大工业用户晚高峰负荷突增，并按行业和地市排名",
    operatingHint: "关注大工业负荷突增、合同容量利用率、行业排名和客户服务风险。"
  },
  {
    id: "ai_ops",
    name: "AI 平台运维人员",
    shortName: "AI 运维",
    icon: Bot,
    scopeLabel: "AI / 数据链路运维",
    defaultTab: "AI 建任务",
    visibleTabs: ["AI 建任务", "多Agent编排", "AI 问数", "模拟压测", "全省态势"],
    cities: ["太原", "大同", "长治", "运城"],
    riskFilter: "ai",
    defaultTextToSqlQuery: "统计近1小时 Text2SQL 查询耗时、失败率、命中向量表数量和回退次数",
    defaultAgentQuery: "检查 Python AI、DeepSeek、Milvus、实时宽表和离线校验链路是否健康，并生成排障步骤",
    operatingHint: "关注 DeepSeek、Milvus、Flink、离线校验任务和接口稳定性。"
  }
];

export const defaultRole = roles[0];
