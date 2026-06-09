# scctl Scope Enhancement — Design Spec

**Status**: approved (render model **R1**)  
**Date**: 2026-06-09  
**Audience**: internal — Zhou Yi / Transverse Sound Lab  
**Purpose**: Make scctl a better Agent driver for SuperCollider in the **design phase**. Not sound design, not runtime OSC, not ontology.

---

## 1. Problem

SuperCollider can perform the synthesis operations this project will need. scctl already spawns `sclang` and evaluates code, but Agent workflows are incomplete:

- No MCP `sc_run_file`
- `getLogs()` exists but is not exposed
- No first-class `sc_render` (only ad-hoc `record-music.js`)
- CLI and MCP are not aligned

**scctl does not make sound.** SuperCollider does. scctl must improve: **check → run → logs → render → stop**.

---

## 2. Scope

### In

- Execute sclang / `.scd` files
- Post log buffer for debugging
- Record WAV via wrapped `s.record` workflow (**R1**)
- Graceful stop (existing)
- CLI ↔ MCP parity
- Generic smoke fixture + technical integration tests

### Out

- Four Images / bagua / hexagram mapping or fixtures
- isobar, OSC bridge, formation / QRNG
- 20+ MCP tools, music frameworks, AI composition
- Quarks / sc3-plugins management
- Public repo naming / marketing

---

## 3. External surface

### MCP tools (6 total — unchanged count)

| Tool | Status | Description |
|------|--------|-------------|
| `sc_check` | extend later (P4) | `sclang` path; optional server reachability |
| `sc_eval` | exists | Evaluate SuperCollider code in persistent session |
| `sc_run_file` | **new** | Read and evaluate a `.scd` file |
| `sc_logs` | **new** | Return ring-buffer post output (`tail` optional) |
| `sc_render` | **new** | R1 wrapped record to WAV |
| `sc_stop` | exists | Stop controller and audio |

### CLI (parity)

```bash
scctl check
scctl run <file.scd>
scctl logs [--tail N]
scctl render <file.scd> -o <out.wav> [--duration SECONDS]
scctl stop    # optional for one-shot CLI; MCP session uses sc_stop
```

`scctl eval` is optional convenience; MCP already has `sc_eval`.

---

## 4. Render model — R1 (wrapper)

scctl injects boot/record/stop around user code. User code is responsible only for making sound (e.g. `.play`).

### MCP `sc_render` parameters

```json
{
  "path": "/optional/path.scd",
  "code": "// optional inline SC; exactly one of path|code required",
  "out": "/absolute/path/out.wav",
  "duration": 5
}
```

- `duration` default: `5` seconds (Node-side wait)
- `out` must be writable; parent dirs must exist or be created by caller

### Execution flow

```text
1. boot SclangController
2. execute wrapped block:
     s.boot; s.sync;
     <user code from path or code param>
     s.prepareForRecord("<escaped out>"); s.sync;
     s.record; s.sync;
3. Node sleep(duration * 1000)
4. execute: s.stopRecording; s.sync;
5. verify fs.existsSync(out) && size > 0
6. stop controller
7. return { success, out, bytes, output }
```

### Agent constraints (tool descriptions)

- Do not call `s.record` / `s.stopRecording` inside user code when using `sc_render`
- Do not rely on `Pdef`/`Routine` duration for render length — use `duration` parameter
- For audition without WAV, use `sc_eval` instead

### Shared implementation

Extract `renderSession()` from `record-music.js` into `src/runtime/render.ts`. CLI and MCP both call it.

---

## 5. `sc_run_file`

Same core logic as CLI `run` (read file → execute). MCP reuses `activeController` like `sc_eval`.

**Decision**: `sc_run_file` keeps session open (like `sc_eval`). `sc_render` always stops after (clean file handles).

```text
validate path → read UTF-8 → boot (if needed) → execute(contents) → return result
# no stop — session stays open for further sc_eval / sc_run_file
```

---

## 6. `sc_logs`

Expose `SclangController.getLogs()`:

```json
{ "tail": 8000 }  // optional; default entire buffer up to maxLogBytes
```

No new runtime behavior.

---

## 7. `sc_check` extension (P4, optional)

After P1–P3:

```text
sclang: OK | MISSING
path: ...
server: unknown | running | not_running   # short eval probe
```

No Quarks/plugins in this phase.

---

## 8. Code layout

```text
src/
  runtime/
    sclang.ts      # existing
    discover.ts    # existing
    render.ts      # NEW — renderSession()
  mcp/server.ts    # add handlers
  cli.ts           # add logs, render; optional eval
fixtures/
  smoke/
    sine-play.scd  # { SinOsc.ar(440, 0, 0.1) }.play;
tests/
  runtime/render.test.ts   # mock sclang where possible
  mcp/server.test.ts       # extend for new tools
```

Refactor to `src/commands/*` only if duplication hurts; not required for P1–P2.

---

## 9. Smoke & acceptance

```bash
npm run build
scctl check
scctl render fixtures/smoke/sine-play.scd -o /tmp/scctl-smoke.wav --duration 2
test -s /tmp/scctl-smoke.wav
```

Technical checklist (design-notes §10 subset):

1. boot + sine via eval  
2. stop all  
3. bad UGen → `success: false`, output readable  
4. render 5s WAV  
5. logs readable after error  

---

## 10. Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **P1** | `sc_logs`, `sc_run_file` (MCP + CLI logs) |
| **P2** | `render.ts`, `sc_render`, CLI `render`, retire generic demo dependency |
| **P3** | smoke fixture + tests |
| **P4** | `sc_check` server probe |

Do not start Zhou Yi `.scd` assets in scctl repo.

---

## 11. Success statement

When P1–P3 are green:

> An Agent can drive SuperCollider through scctl to evaluate code, run `.scd` files, read post logs, record WAV samples, and stop cleanly — without SuperCollider IDE. scctl does not implement project sound logic; that remains in `.scd` files written for SuperCollider.

---

## 12. Agent rules & workflow (approved)

### SC content boundary

> SuperCollider files implement **triggerable sound** (SynthDefs, playback, render snippets). Formation, oracle, casting, and hexagram/stage decisions stay in **Python / FormationBundle** — never in `.scd`.

MCP tool descriptions must repeat: do not encode formation/oracle logic in SC.

### Session boundary

| Action | Session |
|--------|---------|
| `sc_eval`, `sc_run_file` | Keep open — iterate on same code |
| `sc_render` | Always `sc_stop` after (R1) |
| End of task / switch file or topic / audio acts wrong | Agent must call `sc_stop` before starting fresh work |

Design phase tolerates extra boots; dirty sessions are worse than rebooting.

### Working directory (**C** — approved)

- No default cwd baked into scctl.
- Agent **cd per task** (`super/` for tool smoke, `Zhou Yi/` for project `.scd`).
- **Always pass absolute paths** to `sc_run_file`, `sc_render` `path`/`out`, and CLI file arguments.

### Draft outputs

- Rendered WAV drafts: `Zhou Yi/artifacts/sc-drafts/` (or caller-chosen absolute path).
- Do not commit draft WAVs to git.

### Manual cleanup (operators)

If audio behaves oddly after `sc_stop`:

```bash
pkill -f scsynth
pkill -f sclang
```

scsynth is a separate process; scctl does not guarantee OS-level cleanup.

---

## 13. Risks & known limits

| Risk | Mitigation |
|------|------------|
| sclang + scsynth are two processes | `sc_stop`; manual pkill if needed |
| R1 render = fixed-duration realtime record | Not for all Pattern/NRT; P5 may add NRT or done-signal |
| Session state pollution | Session rules above; future `sc_reboot` (P4+) |
| Log buffer cap (512KB) | `sc_logs`; tail param; large errors may truncate |
| macOS audio device / Logic conflict | Human checks Audio MIDI Setup; P4 `sc_check` probe |
| Design SC vs future OSC Path B″ | SC = reusable SynthDefs; avoid one-off eval-only logic |
| Python reference vs SC drift | SC is thickening reference, not replacing ontology |

**Future (out of P1–P3):** `sc_reboot`, `sc_check` device hint, `sc/_lib/boot.scd` bootstrap, NRT render (P5).

---

## 14. Related docs

- `docs/design/control-approach-notes.md` — original bridge rationale
- Zhou Yi `docs/technical-architecture-map.md` — Path B″ (future, out of this spec)
