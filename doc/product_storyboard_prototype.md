# 山西省全量用电用户实时智能运营平台 - 产品文档与原型分镜提示词

> 文档状态：原型设计版  
> 适用对象：产品原型、UI 视觉、研发排期、演示脚本  
> 核心目标：先把产品讲真实，再把页面画具体，最后让每个画面都能体现 PG -> Flink CDC -> Fluss -> Flink -> StarRocks / Paimon 的真实技术链路。

---

## 1. 产品一句话

山西省全量用电用户实时智能运营平台，是面向省、市、县供电公司的实时用电运营、风险告警、AI 问数、AI 建任务和数据链路压测平台。

它不是单纯大屏，也不是只展示几张假图。它的核心是把真实数据链路跑起来：

```text
PostgreSQL 源库
  -> Flink CDC
  -> Fluss ODS/DWD Changelog
  -> Flink SQL / Window TVF / CEP / Batch
  -> StarRocks 内表实时 ADS
  -> Paimon 离线快照与冷数据
  -> StarRocks 外表 / 统一视图
  -> API / Web / Text-to-SQL / AI Agent
```

前端所有关键指标默认从 StarRocks 服务层读取。模拟按钮只负责往 PostgreSQL 源库造数或触发链路任务，不绕过链路直接改前端结果。

---

## 2. 产品定位

### 2.1 业务定位

平台覆盖山西省全部用电用户，不再局限煤改电。用户对象包括：

- 居民用户
- 一般工商业用户
- 大工业用户
- 高耗能行业用户
- 农业排灌用户
- 充电站用户
- 分布式光伏用户
- 园区和重点保供企业

核心业务价值：

- 省公司看全省负荷态势和地市风险。
- 市公司看本市区县、线路、台区和重点企业。
- 县公司看具体用户、表计、台区、工单和告警。
- 数据团队用 AI 问数、建宽表、发任务。
- 演示和测试人员用浮动控制台造实时流、批量数据、CEP 场景和离线快照。

### 2.2 技术展示定位

产品必须显性展示以下能力：

| 技术能力 | 产品表现 |
| --- | --- |
| Flink CDC YAML | 源库接入任务可视化、任务提交状态、CDC 变更条数 |
| Fluss | ODS/DWD/DWS 分层、changelog 延迟、分层归档状态 |
| Flink Window TVF | 1 分钟、5 分钟、日累计窗口指标曲线 |
| Flink CEP | 重载转过载、三相不平衡、突增突降链式告警 |
| Paimon | 离线快照、冷数据分区、batch 校准结果 |
| StarRocks 内表 | 实时看板、风险队列、Text-to-SQL 查询来源 |
| StarRocks 外表 | 冷热统一视图、离线接口兜底 |
| Milvus + BGE-M3 | 元数据、DDL、指标口径、历史 SQL 召回 |
| LanceDB / Lance | 原始资料、标签、版本、评测样本和 Agent 过程资产 |
| DeepSeek | Text-to-SQL 生成、AI 建任务规划、多轮口径确认 |
| Python 数据模拟 | 大批量造数、实时遥测、CEP 异常、升级中对账 |
| Docker Compose | 一键启动全链路本地演示 |

---

## 3. 用户角色与权限表现

本阶段不做登录，前端提供角色切换器。角色切换影响默认区域、可见粒度、操作按钮和提示语。

| 角色 | 默认视角 | 可见粒度 | 重点按钮 |
| --- | --- | --- | --- |
| 省公司调度运营 | 山西省 | 地市、行业、全省链路 | 全省态势、批量离线校准、全链路体检 |
| 市公司运维 | 当前地市 | 区县、线路、台区、企业 | 处置告警、查看区县下钻、启动实时场景 |
| 县公司班组 | 当前区县 | 台区、计量点、用户 | 告警确认、模拟用户级异常、生成工单 |
| 数据分析师 | 全省数据资产 | 表、指标、SQL、图表 | Text-to-SQL、保存分析、导出报表 |
| 数据工程师 | 数据链路 | 作业、表、血缘、延迟 | 提交 Flink、创建 ADS、离线 batch |
| 演示/测试 | 全部模拟能力 | 场景、数据量、压测结果 | 开实时流、大批量插入、CEP 注入、停止模拟 |

角色切换要体现真实差异：

- 省公司地图默认展示 11 个地市。
- 市公司点击地市后展示区县。
- 县公司展示台区、线路、用户点位列表。
- 数据工程师看到链路 DAG、Flink 作业、StarRocks 表和 Paimon 快照。
- 演示/测试角色的右下角浮动控制台默认展开。

---

## 4. 核心业务对象

### 4.1 组织与电网拓扑

```text
山西省
  -> 地市公司
  -> 区县公司
  -> 供电所
  -> 变电站
  -> 10kV 线路
  -> 台区/配变
  -> 计量点/电表
  -> 用电用户
```

### 4.2 用户画像字段

| 分组 | 字段 |
| --- | --- |
| 基础档案 | 用户编号、户名、地市、区县、地址、行业、用户类别 |
| 供电关系 | 供电所、变电站、线路、台区、计量点、电表 |
| 容量合同 | 合同容量、运行容量、最大需量、变压器容量 |
| 实时负荷 | 当前负荷、今日电量、峰值、负荷率、功率因数 |
| 风险标签 | 重载、过载、低功率因数、三相不平衡、突增、突降、疑似停产复产 |
| 数据质量 | 采集完整率、晚到率、补采率、CDC 更新次数、离线校准差异 |

### 4.3 大工业重点字段

大工业用户用于体现更真实的国网业务价值：

- 行业：煤炭、焦化、钢铁、电解铝、装备制造、化工、园区。
- 用电特征：连续生产、班次生产、季节性生产、错峰生产。
- 风险指标：最大需量接近合同容量、功率因数低、突增突降、异常复产、保供风险。
- 分析维度：地市、区县、行业、线路、园区、企业集团。

---

## 5. 端到端数据链路设计

### 5.1 数据源层：PostgreSQL

PostgreSQL 是唯一模拟业务源库。前端模拟按钮、Python 造数脚本、批量压测脚本都写入 PG。

建议源表：

| 表 | 说明 |
| --- | --- |
| `ods_user_profile` | 用户档案和业务标签 |
| `ods_grid_topology` | 省市县、变电站、线路、台区拓扑 |
| `ods_meter_reading` | 实时遥测和电量明细 |
| `ods_risk_event_seed` | 人工注入的风险事件种子 |
| `ods_work_order` | 告警处置和工单状态 |
| `ods_schema_change_log` | 升级中场景的 schema 和口径变化记录 |

### 5.2 接入层：Flink CDC

使用 Flink CDC YAML 把 PostgreSQL 表接入 Fluss。

产品上展示：

- CDC 任务名称
- 源表和目标表
- 当前 offset / LSN
- insert、update、delete 计数
- 最近一次 schema 变更
- 任务状态：待提交、运行中、失败、重启中

### 5.3 实时湖仓层：Fluss

Fluss 承载 ODS、DWD、DWS 三层 changelog。

分层建议：

| 层 | 表 | 作用 |
| --- | --- | --- |
| ODS | `ods_meter_reading_changelog` | 原始 CDC 变更 |
| DWD | `dwd_user_meter_wide` | 用户、计量点、台区、行业宽表 |
| DWS | `dws_area_window_load` | 地市/区县窗口聚合 |
| DWS | `dws_industry_window_load` | 行业窗口聚合 |
| DWS | `dws_cep_risk_event` | CEP 复杂事件 |

前端链路页面要把 Fluss 的角色说清楚：它不是普通消息队列，而是保留 changelog 的实时湖仓中间层。

### 5.4 计算层：Flink SQL / TVF / CEP / Batch

Flink 负责四类任务：

| 类型 | 任务 | 结果 |
| --- | --- | --- |
| CDC 同步 | PG 表到 Fluss ODS | 变更流 |
| Window TVF | TUMBLE、HOP、CUMULATE | 实时窗口指标 |
| CEP | 重载转过载、三相不平衡、突增突降 | 风险告警流 |
| Batch | 从 Paimon 快照跑离线校准 | 离线 ADS 和差异表 |

CEP 前必须做 append-only 桥接：

```text
CDC changelog
  -> 保留 INSERT / UPDATE_AFTER
  -> DELETE 转业务撤销事件
  -> 进入 MATCH_RECOGNIZE / CEP
```

### 5.5 服务层：StarRocks 内表 + 外表

StarRocks 是前端和 Text-to-SQL 的默认查询入口。

| 表类型 | 用途 |
| --- | --- |
| 内表 Primary Key | 实时 ADS、风险队列、用户当前态 |
| 内表 Duplicate / Aggregate | 窗口统计、行业排名、地市排名 |
| Paimon 外表 | 离线快照、历史冷数据 |
| 统一视图 | 对外屏蔽冷热表差异 |

页面指标要显示数据来源：

- `StarRocks 内表实时`
- `StarRocks 外表离线`
- `实时 + 离线校准`
- `链路未就绪，使用 fixture fallback`

### 5.6 AI 检索层：Milvus + LanceDB

Milvus 负责在线向量召回：

- DDL
- 字段说明
- 指标口径
- 历史 SQL
- 示例问题
- 血缘关系摘要

LanceDB / Lance 负责 AI 资料治理：

- 原始 Excel、文档、需求说明
- chunk、标签、版本、来源
- embedding 模型版本
- Text-to-SQL 评测集
- Agent 中间计划
- 用户反馈和人工修正样本

推荐模型：

- MVP：`BAAI/bge-m3`
- 对照评测：`Qwen3-Embedding`
- reranker：BGE reranker 或同系列中文 reranker

---

## 6. 核心页面设计

### 6.1 全省态势首页

首页是运营台，不是纯展示大屏。

布局：

- 顶部：角色切换、省市县面包屑、链路状态、当前数据源。
- 左侧：组织树、用户类型、行业、风险类型过滤。
- 中间：山西省真实 GIS 地图，省 -> 市 -> 县下钻。
- 右侧：实时告警队列、CEP 事件、离线校准差异。
- 底部：今日负荷、昨日负荷、预测负荷、离线校准曲线。
- 右下角：浮动模拟控制台按钮。

关键交互：

- 点击太原市，地图切到太原市区县。
- 点击某个区县，右侧队列只展示该区县风险。
- 点击风险事件，打开用户/台区详情抽屉。
- KPI 数字随 StarRocks 查询结果刷新。
- 若链路异常，顶部显示降级原因。

### 6.2 省市县下钻地图

地图必须是正常山西行政区划风格，而不是柱状 3D。

视觉要求：

- 浅灰页面底色，白色业务卡片，国网绿强调色。
- 山西轮廓清楚。
- 地市边界和区县边界明确。
- 颜色表达风险热度。
- 点位表达重点大工业用户、重载线路、告警台区。
- 鼠标 hover 显示区域负荷、用户数、告警数、链路延迟。

下钻层级：

```text
省视图：11 个地市
  -> 市视图：该市所有区县
  -> 县视图：供电所、线路、台区、重点用户点位
```

### 6.3 实时风险与 CEP 控制台

用途：展示 Flink CEP 不只是概念，而是真能产生链式事件。

模块：

- CEP 规则卡片：重载转过载、三相不平衡、突增突降、线路温升。
- 实时事件流：事件时间、区域、对象、阶段、置信度。
- 匹配路径：合理 -> 重载 -> 过载的时间线。
- 撤回与修正：CDC 更新/补采导致告警被离线校准确认或撤销。

### 6.4 Text-to-SQL 页面

用途：用户自然语言查询 StarRocks。

页面结构：

- 左侧：自然语言输入和多轮对话。
- 中间上：生成 SQL、SQL AST 安全校验结果。
- 中间下：表格结果和图表结果。
- 右侧：Milvus 命中证据，包含表、字段、指标、历史 SQL。
- 底部：保存为分析、转为数据任务、导出 CSV。

关键按钮：

- 生成 SQL
- 执行查询
- 生成图表
- 保存分析
- 无宽表，进入 AI 建任务

### 6.5 AI 建任务页面

当 Text-to-SQL 找不到合适结果表或宽表时进入该页面。

步骤条：

1. 语义拆解
2. 元数据召回
3. 业务口径确认
4. 生成 Flink SQL / StarRocks DDL
5. 样例试跑
6. 性能优化
7. 发布 DWS/ADS
8. 注册向量样本

页面重点：

- 展示 Agent 的计划，不展示冗长思维链。
- 用户能修改口径，例如晚高峰时段、突增阈值、行业范围。
- 生成的任务必须能映射到 Flink、Fluss、StarRocks、Paimon。

### 6.6 数据链路运行监控

用途：让用户看清“哪个是 Flink、哪个是 Fluss、哪个是 StarRocks、哪个是 Paimon、哪个是 PG”。

页面设计：

- 横向 DAG：PG -> CDC -> Fluss -> Flink -> StarRocks -> Paimon -> API -> Web。
- 每个节点显示端口、状态、延迟、吞吐、错误数。
- 点击节点展开日志摘要和常用命令。
- Flink 节点显示 JobManager URL 和运行作业。
- StarRocks 节点显示内表行数、最近写入时间。
- Paimon 节点显示快照版本和分区。
- Milvus 节点显示 collection、向量条数、embedding 模型。

### 6.7 浮动模拟控制台

这是前端最重要的“真实交互感”入口。默认在右下角有悬浮按钮，点击展开为控制面板。

控制项：

| 按钮 | 行为 |
| --- | --- |
| 开启实时数据 | 启动 Python simulator，持续写 PG `ods_meter_reading` |
| 停止实时数据 | 停止 simulator，保留当前链路状态 |
| 大批量离线插入 | 向 PG 批量插入 1 万 / 10 万 / 100 万条历史数据 |
| 注入 Window 数据 | 生成稳定、突增、突降、峰谷曲线，验证 TVF |
| 注入 CEP 数据 | 生成重载转过载、三相不平衡、线路温升事件 |
| 注入 CDC 更新删除 | 生成 UPDATE、DELETE、补采、撤回场景 |
| 触发离线 Batch | 从 Paimon 快照跑 Flink batch，写离线 ADS |
| 链路体检 | 检查 PG、Flink、Fluss、StarRocks、Paimon、Milvus |
| 清空演示数据 | clean 模式重置 PG、Fluss、StarRocks、Paimon |

控制台状态：

- 未启动：灰色按钮，提示一键启动。
- 实时中：绿色脉冲，显示每秒写入条数。
- 压测中：国网绿进度条，显示总量、速率、预计完成时间。
- CEP 注入中：红色告警计数实时增长。
- 离线校准中：紫色进度条，显示 Paimon 快照版本。
- 失败：展示失败节点和重试按钮。

---

## 7. 一键启动与演示脚本

### 7.1 一键启动目标

用户只执行一个脚本：

```bash
./scripts/start-full-stack.sh
```

脚本应该完成：

1. 启动 Docker Compose 全链路服务。
2. 等待 PostgreSQL、Flink、Fluss、StarRocks、Milvus、AI、API、Web 就绪。
3. 初始化 PG 源表和基础档案。
4. 提交 Flink CDC 到 Fluss。
5. 提交 Flink Window TVF 和 CEP 作业。
6. 初始化 StarRocks 内表、Paimon 外表和统一视图。
7. 加载 Milvus 元数据向量。
8. 打印访问地址和验证命令。

### 7.2 标准输出示例

```text
Docker stack is running in detached mode.
Mode: lakehouse full stack

Source:
  PostgreSQL:    localhost:5432
Streaming:
  Flink UI:      http://localhost:8083
  Fluss:         coordinator localhost:9123, tablet localhost:9124
Serving:
  StarRocks FE:  http://localhost:8030
  StarRocks SQL: localhost:9030
Lake:
  Paimon:        s3://fluss/paimon
AI:
  Milvus gRPC:   localhost:19530
  AI service:    http://localhost:8000/health
App:
  API:           http://localhost:4000/health
  Web:           http://localhost:5051

Running jobs:
  pg-to-fluss-cdc              RUNNING
  user-load-window-tvf         RUNNING
  grid-risk-cep                RUNNING
  paimon-hourly-snapshot       SCHEDULED

Useful commands:
  pnpm stack:ps
  pnpm stack:logs flink-jobmanager
  pnpm stack:logs starrocks
  pnpm stack:down
```

### 7.3 演示路径

1. 打开首页，确认全省用户数、负荷、告警来自 StarRocks 内表。
2. 点击山西地图中的太原市，下钻到区县。
3. 展开浮动模拟控制台，点击“开启实时数据”。
4. 观察首页 KPI、地图热力、右侧风险队列刷新。
5. 点击“注入 CEP 数据”，观察重载转过载事件出现。
6. 打开 Flink UI，看到 CDC、TVF、CEP 作业 RUNNING。
7. 打开 Text-to-SQL，输入“查询太原大工业用户负荷 Top10 并出图表”。
8. 点击“生成图表”，展示柱状图。
9. 输入一个不存在宽表的问题，进入 AI 建任务。
10. 点击“触发离线 Batch”，观察离线校准差异和 Paimon 快照版本。

---

## 8. 非功能目标

| 指标 | 目标 |
| --- | --- |
| 本地启动 | 一条脚本启动核心链路 |
| 首页刷新 | 2-5 秒可见实时变化 |
| Text-to-SQL | 生成 SQL、执行、表格、图表完整闭环 |
| 大批量模拟 | 支持 10 万级批量插入演示 |
| CEP 注入 | 1 分钟内可见链式告警 |
| 离线兜底 | 可手动触发 batch 产出校准结果 |
| 链路可解释 | 页面能看清每个组件职责和状态 |
| 降级策略 | StarRocks 不可用时明确提示 fallback，不能假装实时 |

---

## 9. 原型分镜图片提示词

以下提示词用于生成原型图。建议统一使用 16:9 横屏，国网绿主色、清新明亮政企系统风格，shadcn/ui 组件质感，真实山西地图，不要科技感过度发光，不要抽象柱子地图。品牌视觉接近国家电网绿色，白色和浅灰底色，绿色强调色，少量橙红表达风险。

### 分镜 1：首页全省态势

```text
生成一张 16:9 的产品原型图，主题是“山西省全量用电用户实时智能运营平台 - 全省态势首页”。国网绿主色、清新明亮政企系统风格，React shadcn/ui 质感，顶部有角色切换器、省市县面包屑、链路状态徽标、数据源徽标“StarRocks 内表实时”。中间是清晰真实的山西省行政区划地图，显示 11 个地市边界，使用热力颜色表示风险等级，地图上有重点大工业用户点位和线路风险点。左侧是组织树和筛选器：用户类型、行业、风险类型。右侧是实时告警队列，包含 CEP 事件、离线校准差异、工单状态。底部是今日负荷、昨日负荷、预测负荷、离线校准四条曲线。右下角有一个悬浮圆形按钮“模拟控制台”。界面真实、密集、可操作，不要营销官网风。
```

### 分镜 2：省市县地图下钻

```text
生成一张 16:9 的产品原型图，主题是“山西省 GIS 下钻分析”。画面左上角面包屑显示“山西省 / 太原市 / 小店区”，中心地图展示太原市区县边界和小店区高亮，地图上有台区、线路、大工业企业点位，点位颜色区分重载、过载、低功率因数。右侧详情面板展示所选区县的用户数、当前负荷、大工业用户、告警数、Flink 延迟、StarRocks 最近写入时间。下方有区县排名表和风险趋势小图。整体像电力运营驾驶舱，但是控件使用 shadcn 风格，边框克制，文字清晰。
```

### 分镜 3：浮动模拟控制台展开

```text
生成一张 16:9 的产品原型图，主题是“实时数据模拟与压测浮动控制台”。背景仍然是山西全省态势首页，右下角悬浮面板已展开，占屏幕右侧三分之一。面板标题为“链路模拟控制台”，包含按钮：开启实时数据、停止实时数据、大批量离线插入、注入 Window 数据、注入 CEP 数据、注入 CDC 更新删除、触发离线 Batch、链路体检、清空演示数据。每个按钮旁有状态灯和简短说明。面板中部有实时写入速率、PG 行数、Flink CDC 延迟、Fluss changelog 条数、StarRocks 写入行数、Paimon 快照版本。底部有进度条和日志摘要。风格真实可用，像开发演示控制台，不要玩具化。
```

### 分镜 4：实时风险与 CEP

```text
生成一张 16:9 的产品原型图，主题是“Flink CEP 实时风险控制台”。左侧是 CEP 规则卡片列表：重载转过载、三相不平衡持续扩大、大工业突增突降、线路温升。中间是事件匹配时间线，展示某台区从“合理 -> 重载 -> 过载”的连续事件，每个阶段有事件时间、负荷率、来源表。右侧是实时告警流，红橙黄分级，展示区域、对象、置信度、处置状态。底部是技术链路小 DAG：PostgreSQL -> Flink CDC -> Fluss -> Flink CEP -> StarRocks -> WebSocket。界面突出“真实 CEP 链式事件”，不要单纯列表。
```

### 分镜 5：Text-to-SQL 问数与图表

```text
生成一张 16:9 的产品原型图，主题是“AI Text-to-SQL 问数”。左侧是聊天输入区，用户问题为“查询太原大工业用户负荷 Top10 并按行业出图表”。中间上方显示 DeepSeek 生成的 StarRocks SQL，旁边有 SQL AST 安全校验通过、LIMIT 1000、只读 SELECT 徽标。中间下方同时展示结果表格和柱状图，图表标题为“太原大工业负荷 Top10”。右侧是 Milvus + BGE-M3 召回证据列表，包含命中的 ADS 表、字段说明、指标口径、历史 SQL。底部按钮：执行查询、生成图表、保存分析、转为 AI 建任务。整体像真实数据分析工具。
```

### 分镜 6：无宽表时 AI 建任务

```text
生成一张 16:9 的产品原型图，主题是“AI 从 0 创建实时数据任务”。顶部步骤条包含：语义拆解、元数据召回、口径确认、生成任务、样例试跑、性能优化、发布资产、注册向量样本。左侧是用户自然语言需求和多轮口径确认，例如“晚高峰按 18:00-22:00，突增按近 7 日均值 2 倍”。中间是 Agent 生成的任务计划，包含 Flink SQL、Window TVF、StarRocks ADS 表、Paimon 离线快照。右侧是校验结果：样例行数、空值率、延迟、主键建议、分区建议、并行度建议。底部有“提交 Flink 作业”“发布 StarRocks 表”“加入 Milvus 语义层”按钮。风格专业、工程化。
```

### 分镜 7：数据链路运行监控

```text
生成一张 16:9 的产品原型图，主题是“全链路运行拓扑监控”。画面中央是横向 DAG：PostgreSQL 源库 -> Flink CDC -> Fluss ODS/DWD -> Flink SQL/TVF/CEP -> StarRocks 内表 ADS -> Paimon 离线快照 -> StarRocks 外表统一视图 -> API -> Web。每个节点是可点击卡片，显示状态 RUNNING、端口、吞吐、延迟、错误数。下方有 Flink 作业表：pg-to-fluss-cdc、user-load-window-tvf、grid-risk-cep、paimon-hourly-snapshot。右侧有日志摘要和常用命令：pnpm stack:ps、pnpm stack:logs flink-jobmanager、pnpm stack:down。界面要让人一眼看懂哪个是 Flink、哪个是 Fluss、哪个是 StarRocks、哪个是 Paimon。
```

### 分镜 8：大工业用户分析

```text
生成一张 16:9 的产品原型图，主题是“山西大工业用户专项分析”。顶部 KPI 展示大工业用户数、当前负荷、今日峰值、合同容量风险、功率因数异常。左侧是行业筛选：煤炭、焦化、钢铁、电解铝、化工、装备制造。中间是行业负荷堆叠面积图和企业负荷曲线对比。右侧是企业风险排行，显示企业名称、地市、行业、当前负荷、最大需量、功率因数、风险标签。底部是同园区、同线路、同行业联动分析。风格像真实电力经营分析系统，不要泛泛 BI 模板。
```

### 分镜 9：离线 Batch 与 Paimon 校准

```text
生成一张 16:9 的产品原型图，主题是“流批一体离线校准”。左侧展示 Paimon 快照列表，包含快照版本、分区日期、行数、生成时间。中间展示 Flink Batch 任务进度，任务名为 paimon-hourly-snapshot 和 ads-offline-reconcile。右侧展示实时 ADS 与离线 ADS 差异表，字段包括区域、指标、实时值、离线值、差异率、是否修正。顶部有按钮“触发离线 Batch”“切换离线兜底接口”。底部是冷热统一查询示意：StarRocks 内表 + Paimon 外表 UNION ALL。界面强调离线兜底真实存在。
```

### 分镜 10：移动或窄屏值班视图

```text
生成一张移动端或窄屏产品原型图，主题是“县公司值班告警视图”。界面为清新明亮，国网绿顶部栏，顶部显示当前角色“县公司班组”和区域“小店区”。第一屏显示关键 KPI：异常用户、过载台区、待处理工单、链路状态。下方是告警卡片流，每张卡片包含台区、用户、风险类型、负荷率、发生时间、处置按钮。底部有简化地图缩略图和“上报处置”“查看链路”按钮。不要营销风，像真实值班工具。
```

---

## 10. 原型生成统一负向要求

生成图片时避免：

- 不要煤改电单一主题。
- 不要只画一根 3D 大柱子。
- 不要抽象中国地图，要真实山西行政区划。
- 不要纯装饰科技蓝或暗黑大屏，要有真实表格、按钮、状态、日志、链路。
- 不要只展示 mock 数字，要展示数据来源和链路状态。
- 不要登录页。
- 不要营销官网首页。
- 不要把 Flink、Fluss、StarRocks、Paimon 混成一个“数据平台”黑盒。

---

## 11. 后续研发拆分建议

1. 数据链路：PG 源表、Flink CDC、Fluss 表、StarRocks 内表、Paimon 快照一键初始化。
2. Python simulator：实时流、大批量、Window、CEP、CDC 更新删除、升级中场景。
3. API 控制面：启动/停止模拟、触发 batch、链路体检、读取 StarRocks。
4. 前端首页：真实山西地图、省市县下钻、数据源徽标、浮动控制台。
5. Text-to-SQL：Milvus 检索、DeepSeek 生成、StarRocks 执行、图表按钮。
6. AI 建任务：无宽表时多轮口径确认、生成任务计划、试跑和发布。
7. 运行拓扑：清楚展示 Flink、Fluss、StarRocks、Paimon、PG 的实际状态。

