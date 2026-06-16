# Documentation index

**Start here.** Single router for `docs/` — other files should link here instead of maintaining parallel tables of contents.

| I am… | Read (in order) | Skip |
|-------|-----------------|------|
| **Wiring a consumer project** | [consumer-bootstrap](guides/consumer-bootstrap.zh-CN.md) → [governed-pilot-tutorial](guides/governed-pilot-tutorial.zh-CN.md) | Deleted historical `plans/` (see git history) |
| **Operating / debugging** | [operator-runbook](operator-runbook.md) · [smoke-troubleshooting](smoke-troubleshooting.md) | Long architecture prose in root README |
| **Changing this repo** | [AGENTS.md](../AGENTS.md) → [design specs](#design-specs-tier-2) | — |
| **Agent runtime (handoff)** | [status](superpowers/status.md) → [kb/](superpowers/kb/) · [roles/](superpowers/roles/) | Non-essential design research |
| **Current progress** | **[status.md](superpowers/status.md)** only | Phase summaries copied elsewhere |

## Tiers

```text
Tier 0  This page + README* + AGENTS.md     entry only
Tier 1  guides/ + operator-runbook*        human how-to
Tier 2  design/                            stable specs & rationale
Tier 3  superpowers/kb + roles             short agent runtime rules
```

**Rules:** progress lives only in `status.md`; register new design files in the table below; skill eval output goes to local gitignored `docs/_artifacts/`.

Full map (Chinese): [README.zh-CN.md](README.zh-CN.md)

## Design specs (Tier 2)

| Document | Role |
|----------|------|
| [boundary-freeze.md](design/boundary-freeze.md) | Infrastructure phase boundaries |
| [control-approach-notes.md](design/control-approach-notes.md) | Thin control layer rationale |
| [route-enforcement-rules.md](design/route-enforcement-rules.md) | Pilot route + task policy |
| [lab-and-candidates.md](design/lab-and-candidates.md) | Probe / candidate lab + lifecycle |
| [eval-rubric.md](design/eval-rubric.md) | Eval metrics |
| [planner-spec.md](design/planner-spec.md) | Planner I/O |
| [scctl-scope-enhancement.md](design/scctl-scope-enhancement.md) | R1 render spec |
| [zhouyi-supercollider-agent-assessment.zh-CN.md](design/zhouyi-supercollider-agent-assessment.zh-CN.md) | Consumer (Zhou Yi) reference |

## Agent runtime (Tier 3)

[status.md](superpowers/status.md) · [kb/](superpowers/kb/) · [roles/](superpowers/roles/)
