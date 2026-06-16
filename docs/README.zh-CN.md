# 文档导航

**从这里开始。** 本页是 `docs/` 的唯一路由表；其它文件不应再各自维护一份完整目录。

## 先选你的角色

| 你是谁 | 读这些（按顺序） | 暂时不要读 |
|--------|------------------|------------|
| **Consumer 项目接入** | [consumer-bootstrap](guides/consumer-bootstrap.zh-CN.md) → [governed-pilot-tutorial](guides/governed-pilot-tutorial.zh-CN.md) | 已删除的历史 `plans/`（见 git 历史） |
| **日常操作 / 排障** | [operator-runbook](operator-runbook.zh-CN.md) · [smoke-troubleshooting](smoke-troubleshooting.md) | 根 README 里的架构长文 |
| **改本仓库代码** | [AGENTS.md](../AGENTS.md) → 下表「设计规格」 | — |
| **Agent 运行时（handoff）** | [status](superpowers/status.md) → [kb/](superpowers/kb/) · [roles/](superpowers/roles/) · `.agents/skills/scctl-*` | `design/` 研究长文（非日常必读） |
| **查当前进度** | **[status.md](superpowers/status.md)**（唯一真相） | README / AGENTS 里的阶段复述 |

## 文档分层

```text
Tier 0  本页 + README* + AGENTS.md          ← 入口，不堆细节
Tier 1  guides/ + operator-runbook*       ← 人类怎么接、怎么用
Tier 2  design/                           ← 稳定规格与 rationale（为什么）
Tier 3  superpowers/kb + roles            ← Agent 执行时注入的短规则
```

**维护规则：**

1. **进度 / 阶段 / 已完成什么** → 只改 [`superpowers/status.md`](superpowers/status.md)。
2. **新规格或模块契约** → 进 `design/`，并在**本页 design 表**登记一行。
3. **新操作步骤** → 进 runbook 或 tutorial，不要新开「第 N 版 quickstart」。
4. **新 Agent 短规则** → 进 `superpowers/kb/` 或 `.agents/skills/`，不要复制进 README。
5. **Skill 评测输出** → 本地 `docs/_artifacts/`（已在 `.gitignore`，不进仓库）。
6. **禁止**新增平行「总路线图」「总索引」「merge 清单」文档。

## 重复主题 → 权威来源

| 主题 | 权威文件 | 其它文件只应… |
|------|----------|----------------|
| 当前阶段与基线 | [status.md](superpowers/status.md) | 链到 status，不复制阶段表 |
| Pilot 路由与 task tag | [route-enforcement-rules](design/route-enforcement-rules.md) | 举例时链过去 |
| operator vs governed | [operator-runbook](operator-runbook.zh-CN.md) | 一句话 + 链接 |
| Eval 指标定义 | [eval-rubric](design/eval-rubric.md) | kb 里放 checklist 摘要 |
| 角色 tool 策略 | [role-tool-policies.json](superpowers/kb/role-tool-policies.json) | roles/*.md 写行为，不重复 JSON |
| 模块边界 | [AGENTS.md](../AGENTS.md) | 不另写 architecture 总览 |
| 合并前检查 | [CONTRIBUTING.md](../CONTRIBUTING.md) PR 流程 | — |

## 操作与教程（Tier 1）

| 文档 | 用途 |
|------|------|
| [consumer-bootstrap.zh-CN.md](guides/consumer-bootstrap.zh-CN.md) | Consumer 一次性接入清单 |
| [governed-pilot-tutorial.zh-CN.md](guides/governed-pilot-tutorial.zh-CN.md) | Governed 创作闭环教程 |
| [agent-skills-spec.zh-CN.md](guides/agent-skills-spec.zh-CN.md) | `.agents/skills/` 写作规范 |
| [operator-runbook.md](operator-runbook.md) / [中文版](operator-runbook.zh-CN.md) | Operator/debug vs governed |
| [smoke-troubleshooting.md](smoke-troubleshooting.md) | 本机 smoke 排障 |

## 设计规格（Tier 2）

内部架构与模块契约。**Runtime truth** 在代码 + `superpowers/kb/`；下表说明「为什么」。

| 文档 | 角色 |
|------|------|
| [boundary-freeze.md](design/boundary-freeze.md) | 基础设施阶段边界 |
| [control-approach-notes.md](design/control-approach-notes.md) | 薄控制层 rationale |
| [route-enforcement-rules.md](design/route-enforcement-rules.md) | Pilot 路由与 task policy |
| [lab-and-candidates.md](design/lab-and-candidates.md) | Probe / candidate lab 与生命周期 |
| [eval-rubric.md](design/eval-rubric.md) | Eval 指标与解释边界 |
| [planner-spec.md](design/planner-spec.md) | Planner 输入输出与非目标 |
| [scctl-scope-enhancement.md](design/scctl-scope-enhancement.md) | R1 render spec |
| [zhouyi-supercollider-agent-assessment.zh-CN.md](design/zhouyi-supercollider-agent-assessment.zh-CN.md) | Consumer（周易）架构参考（非本仓库 runtime） |

## Agent 运行时（Tier 3）

| 路径 | 用途 |
|------|------|
| [status.md](superpowers/status.md) | 当前基线、限制、已交付行为 |
| [kb/](superpowers/kb/) | `prepare_handoff` KB 快照注入 |
| [roles/](superpowers/roles/) | manager / builder / critic 行为说明 |

---

[English index](README.md)
