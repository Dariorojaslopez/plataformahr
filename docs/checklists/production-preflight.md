# Production pre-flight checklist

Complete **before** production rollout. No item may be skipped with “assume OK”.

- [ ] CI green on the exact git SHA to deploy
- [ ] Image SHA identified for API and Web (immutable tags)
- [ ] Human approval recorded (who / when)
- [ ] Backup confirmed (fresh dump + off-host copy)
- [ ] Secrets configured in runtime (JWT, DB, CORS) — not from `.env.example`
- [ ] DB connectivity verified from migrate/API network path
- [ ] Migration reviewed (SQL diff / Prisma migration list); no unexpected DROP
- [ ] Rollback images known (previous SHA)
- [ ] Monitoring available (logs, `/health`, `/ready`, metrics scrape path)
- [ ] Rollout owner named
- [ ] Deployment window communicated
- [ ] Staging QA for this SHA completed (or equivalent risk acceptance written)
- [ ] `db:seed:dev` / `db:seed:qa` will **not** run
- [ ] `/metrics` not publicly exposed

**GO / NO-GO:** ________  
**Owner:** ________  
**Window:** ________
