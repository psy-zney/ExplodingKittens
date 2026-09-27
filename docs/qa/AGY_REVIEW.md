# AGY review — 2026-09-27

AGY CLI was invoked with ordinary permissions. Its first headless attempt automatically denied a command permission it could not prompt for. No permission bypass was used. A second review supplied selected source through stdin in plan mode and explicitly used no tools; it completed and returned findings. Root checked those findings against the complete code and real deployment.

| Finding | Verification / disposition |
| --- | --- |
| Nginx alias + try_files allegedly broken | Not reproduced. Live index/assets/SPA fallback return correctly; missing asset returns404. `deploy/verify-release.sh` passed. The earlier rewrite/root bug was fixed before this review. |
| Hardcoded Connection upgrade allegedly breaks polling | Full polling games worked. Nginx's official guide supports that form for WebSocket; the final config now uses an http-level map to handle polling and upgrades explicitly. Both forced transports were retested. |
| Cards allegedly missing during Nope | Not present in the complete engine: played cards enter discard before the Nope window. Card conservation checks passed in36 engine tests, including96 complete seeded games. |
| LOBBY allegedly fails game invariant | LOBBY is a room phase, not a GameState phase. Invariants are called on initialized games only. |
| Empty/PlusPlus-only action can publish undefined type | Empty or >3 card selections are rejected by schema and engine; a single PlusPlus is rejected. There is only one physical PlusPlus in the64-card deck. |
| Healthcheck allegedly absent | Compose supplies an explicit wget healthcheck. Deployment waits for healthy before publishing the web build. |
| Copying static files is not atomic; whole backend has no automatic rollback | Valid operational limits. Updates use a maintenance window; in-memory games end on replacement. Config files are backed up and restored if nginx validation fails. No zero-downtime or game-state rollback claim. |
| Snapshot log objects share references inside trusted engine code | Internal API limitation; Socket.IO serializes filtered views, so browsers cannot mutate server references. Card and pending payloads are flat known types. No external mutation route was found. |

AGY continuation instructions are in `AGY_HANDOFF.md`; `scripts/continue-agy.ps1` starts an interactive continuation with normal permissions. The CLI review does not establish physical-phone performance or persistent game storage.
