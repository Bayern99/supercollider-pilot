# Route Enforcement Rules

## Goal

Route enforcement exists to prove that SuperCollider tasks actually ran through Pilot, rather than only claiming they did.

## Task Tags

| Task tag | Required terminal action | Requires `.scd` source | Requires render artifact | Requires review note |
|----------|--------------------------|------------------------|--------------------------|----------------------|
| `sc-audio-generation` | `render` | yes | yes | yes |
| `sc-probe` | none | no | no | no |
| `sc-render-review` | `render` | no | yes | yes |

The canonical source for these rules is `src/harness/policies.ts`.

## Required Evidence

When a task tag is present, callers should preserve:

- the Pilot action that was taken
- the source kind (`inline_code`, `scd_file`, or `none`)
- the source path when `scd_file` was used
- the artifact verification result when a render was required
- the completion snapshot attached to the driver result

## Enforcement Model

`src/harness/completion-rules.ts` evaluates a task result into a `ComplianceSnapshot`.

That snapshot answers:

- whether Pilot was used
- whether a render artifact was complete
- whether the route satisfied the task policy
- why the task passed, failed, or was not applicable

### Soft compliance (default)

Without governed mode env vars, transport surfaces attach compliance metadata but **do not block** execution. This preserves operator/debug workflows.

### Opt-in hard mode (Phase 7.1)

When `SCCTL_GOVERNED_ROLE` is set, `src/harness/role-policies.ts` enforces allowlists at MCP/CLI entry before any SuperCollider work runs. Optional `SCCTL_FINAL_NRT=1` adds a draft-render block aligned with `final_nrt` completion rules.

| Mode | Trigger | Blocks before execution? | Primary module |
|------|---------|--------------------------|----------------|
| Soft compliance | `--task-tag` / MCP `task_tag` | no | `completion-rules.ts` |
| Opt-in RBAC | `SCCTL_GOVERNED_ROLE` | yes (raw runtime tools) | `role-policies.ts`, `transport/governance.ts` |
| IDE hook guard | `.scctl/governed-role` or env | yes (MCP in Cursor) | `hooks/scctl-governed-preflight.js` |

Policy data is shared via `docs/superpowers/kb/role-tool-policies.json` so hooks and in-process checks stay aligned.

## Non-Goals

This phase does not yet:

- block every invalid request before execution
- enforce review-note presence inside runtime
- infer aesthetic quality from route compliance
- allow non-Pilot side paths for SC audio tasks
