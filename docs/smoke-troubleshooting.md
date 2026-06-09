# SuperCollider smoke troubleshooting

Use this when local `scctl check`, `run`, or `render` fails outside CI. CI does not install SuperCollider; failures here are environment-specific.

## Quick smoke

```bash
npm run build
node dist/cli.js check
node dist/cli.js render fixtures/smoke/sine-play.scd -o /tmp/scctl-smoke.wav -d 2
test -s /tmp/scctl-smoke.wav
```

`check` should print `STATUS: OK`, `PATH: ...`, and `SERVER: running|not_running|unknown`.

## Symptoms

| Symptom | What to try |
|---------|-------------|
| `s.boot; s.sync` hangs | `ps aux \| grep scsynth` — kill stale `scsynth` / `sclang` (`pkill -f scsynth`) |
| `yield was called outside of a Routine` | Rebuild (`npm run build`); scctl wraps eval in `fork` — stale `dist/` causes this |
| macOS SIGABRT / no audio | Audio MIDI Setup; quit Logic/DAW apps holding the device |
| `render` exits with 0-byte WAV | `node dist/cli.js run your.scd --tail-logs 500` or MCP `sc_logs` after `sc_eval` |
| `SERVER: not_running` on check | Expected before any boot; run `render` or `sc_eval` with `s.boot` to start scsynth |
| `SERVER: unknown` | sclang probe failed; inspect PATH, permissions, or headless audio (Linux may need PulseAudio/JACK) |

## Manual cleanup

If audio behaves oddly after `sc_stop` or CLI exit:

```bash
pkill -f scsynth
pkill -f sclang
```

## CI vs local

GitHub Actions runs mock-based tests only (no `sclang` install). A green CI does not prove render works on your machine — use the smoke commands above locally.

## Related

- [scctl scope enhancement design](design/scctl-scope-enhancement.md)
- [README smoke section](../README.md)
