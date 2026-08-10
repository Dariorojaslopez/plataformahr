# Post-deploy checklist

Run immediately after production (or staging) rollout.

SHA: ________________  Started: ________  Owner: ________

- [ ] `GET /health` → 200
- [ ] `GET /ready` → 200
- [ ] Login works
- [ ] Critical user flow works (document which: ________)
- [ ] 5xx rate acceptable (define threshold: ________)
- [ ] Logs flowing (JSON, requestIds present)
- [ ] Latency smoke OK (no absurd regressions on list/login)
- [ ] DB connections stable (no connection storm / ready flapping)
- [ ] Metrics scraping (private) OK; cardinality looks normal
- [ ] Rollback threshold defined (e.g. sustained 5xx > X% for Y min → rollback images)

If threshold breached: execute application rollback per [release.md](../release.md); do **not** auto-revert schema.
