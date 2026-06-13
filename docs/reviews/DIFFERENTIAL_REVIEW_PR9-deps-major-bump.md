# Differential Security Review — PR #9 `chore/deps-major-bump`

**Date:** 2026-06-13  
**Reviewer:** AI differential review (Cursor)  
**Scope:** `main...chore/deps-major-bump` (commit `f7268d5`)  
**PR:** https://github.com/Bayern99/supercollider-pilot/pull/9  
**Codebase size:** SMALL (4 files, 0 application logic changes)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall risk** | **LOW–MEDIUM** (supply-chain / transitive deps) |
| **Application code delta** | None (`src/` unchanged) |
| **Auth / crypto / value transfer** | Not touched |
| **CI** | Green (124 tests pass) |
| **npm audit (prod)** | 0 vulnerabilities |
| **Recommendation** | **Approve merge** with post-merge MCP smoke test |

No exploitable vulnerabilities identified in project-owned code. Residual risk is dependency supply-chain surface expansion from MCP SDK 1.x transitive packages (HTTP server stacks unused by stdio transport).

---

## Phase 0: Triage

| File | Risk | Rationale |
|------|------|-----------|
| `package.json` | MEDIUM | Major semver bumps on runtime deps |
| `package-lock.json` | MEDIUM | +79 packages, lockfile integrity |
| `tsconfig.json` | LOW | `"types": ["node"]` — compile-time only |
| `CHANGELOG.md` | LOW | Documentation |

**Risk triggers present:** external-call library upgrade (MCP SDK). No auth, crypto, or validation removal.

---

## Phase 1: Code Analysis

### Application surface (unchanged)

Pilot MCP entry uses **stdio only**:

```678:680:src/mcp/server.ts
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
```

No new HTTP listeners, routes, or network bindings introduced by this PR in `src/`.

### Dependency changes

| Package | Before | After | Notes |
|---------|--------|-------|-------|
| `@modelcontextprotocol/sdk` | 0.6.1 | 1.29.0 | `Server` + schema handlers unchanged; API deprecated but compatible |
| `commander` | 11.1.0 | 15.0.0 | CLI parsing only; no new env/file sinks |
| `typescript` | 5.9.x | 6.0.3 | devDependency; not shipped in `files` |

### Git history on removed security code

**N/A** — no security-related code removed. No commits touching `src/transport/governance.ts`, hooks, or RBAC.

### tsconfig change

```json
"types": ["node"]
```

TypeScript 6 no longer auto-includes `@types/node`. This restores Node globals (`process`, `fs`) at compile time. **No runtime security impact.**

---

## Phase 2: Test Coverage

| Gate | Result |
|------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm test` | 124 passed, 1 skipped |
| CI workflow | Pass on branch |

**Gap:** No automated test asserts MCP SDK 1.x wire protocol compatibility beyond existing unit tests (mocked). **Elevated post-merge verification:** manual `sc_check` via MCP client recommended.

---

## Phase 3: Blast Radius

| Changed symbol / package | Direct callers | Transitive impact |
|--------------------------|----------------|-------------------|
| MCP SDK | `src/mcp/server.ts`, `tests/mcp/server.test.ts` | All MCP tools (orchestration + raw runtime) |
| commander | `src/cli.ts` | All CLI subcommands |
| typescript | build/test only | None in published tarball |

**Blast radius:** MEDIUM for MCP/CLI transport layers, but **behavior preserved** per green test suite.

### New transitive dependencies (MCP SDK 1.x)

Notable additions in lockfile (not directly imported by Pilot):

- `express`, `hono`, `@hono/node-server`, `cors`, `jose`, `express-rate-limit`

**Attack scenario (theoretical):** If a future refactor accidentally imported SDK HTTP server helpers and bound to `0.0.0.0`, expanded deps would increase RCE/SSRF surface. **Current code path:** stdio only — **not exploitable today**.

---

## Phase 4: Adversarial Notes

| Scenario | Exploitability | Mitigation |
|----------|----------------|------------|
| Malicious npm package substitution | Low (lockfile + integrity hashes) | Keep lockfile committed; CI `npm ci` |
| MCP SDK protocol regression leaking tool args | Low | Existing governance + tests; smoke after merge |
| Commander arg injection | Low | No shell spawn from user args in changed code |
| TS6 strictness hiding type unsoundness | Low | typecheck gate in CI |

**No concrete exploit chain** identified against current deployment model (local stdio MCP, Node ≥22).

---

## Findings

### F1 — Supply-chain surface expansion (Informational)

- **Severity:** Informational  
- **Location:** `package-lock.json` (MCP SDK transitive tree)  
- **Evidence:** MCP SDK 1.29 pulls HTTP/auth stack deps unused by stdio transport  
- **Recommendation:** Document in runbook that Pilot must not enable SDK HTTP transports without threat review. Periodic `npm audit`.

### F2 — Missing live MCP integration test (Low)

- **Severity:** Low  
- **Location:** `tests/mcp/server.test.ts` (mocked handlers only)  
- **Evidence:** Major SDK bump with zero `src/` diff  
- **Recommendation:** Post-merge smoke: Cursor MCP `sc_check`, `prepare_handoff` (if governed env set)

---

## Coverage Limits

- Did not audit full MCP SDK 1.29 source (rely on semver + tests + npm audit)
- Did not run `npm run test:live` (requires local SuperCollider)
- Did not review Dependabot `@types/node` 25.x (out of PR scope)

**Confidence:** HIGH for project-owned code; MEDIUM for third-party runtime behavior.

---

## Verdict

**APPROVE** — merge PR #9. Follow with patch release `v1.1.1` and MCP smoke test.

---

## Post-merge checklist

- [ ] Merge PR #9
- [ ] Tag `v1.1.1` (deps-only patch)
- [ ] MCP smoke in Cursor (`sc_check`)
- [ ] Optional: `npm publish` if registry release desired
