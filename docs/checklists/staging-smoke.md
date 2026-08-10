# Staging smoke checklist

Execute after staging deploy (or local staging-like compose). Mark each item.

Environment: ________________  Image SHA: ________________  Date: ________

- [ ] Web loads (HTTP 200 on `/`)
- [ ] API responds (`GET /health` → 200, body `status: ok`)
- [ ] DB ready (`GET /ready` → 200, body `status: ready`)
- [ ] Login succeeds (valid staging user)
- [ ] Logout clears session / refresh cookie
- [ ] RBAC: allowed action succeeds for permitted role
- [ ] RBAC: denied action returns 403 for insufficient role
- [ ] RequestId: response includes `X-Request-Id`
- [ ] Logs: JSON line for request includes matching `requestId` (no passwords/tokens)
- [ ] Metrics: private scrape of `/metrics` works; public path denied if proxy configured
- [ ] Critical flow: primary V1 path (e.g. auth → company context → list resource) OK
- [ ] Controlled error: forced 404/403 shows safe client message; 5xx shows reference id if applicable
- [ ] Cross-tenant: user of company A cannot read/modify company B resource (spot check)

**Result:** PASS / FAIL  
**Notes:**
