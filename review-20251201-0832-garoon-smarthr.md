Finding: Router Never Emits Processor Types
  - Severity: High
  - Location: src/routers/request.router.js:25
  - Issue: The router evaluates keywords per entry, but `REQUEST_TYPE_MAP` only defines `formId/description/processor` (no `keywords`), so every request falls through and returns `null`.
  - Impact: `ETLOrchestrator.execute` treats `null` processors as “unrecognized” and increments the offset forever without processing or persisting any data.
  - Recommendation: Populate `REQUEST_TYPE_MAP` with the keywords/exclusions the router expects or route by formId/fields instead; add tests that prove NEW_HIRE/CHANGE requests get a processor.

Finding: Missing Offset Tracker Implementations
  - Severity: High
  - Location: src/orchestrator/etl.orchestrator.js:7
  - Issue: The orchestrator imports `../utils/offset-tracker.util.js` and `offset-tracker-local.util.js`, but no such modules exist in the repo (only JSON data files).
  - Impact: The first `import` throws at startup, so neither Cloud Function nor local runner can load, preventing any ETL execution.
  - Recommendation: Restore the tracker utility modules (or adjust imports to the available implementation) and add smoke tests that instantiate `ETLOrchestrator` to catch missing dependencies.

Finding: GCP Auth Crashes Outside Production Config
  - Severity: High
  - Location: src/utils/gcp-auth.util.js:28-57
  - Issue: `env.NODE_ENV` defaults to `production`, so `GCPAuth.initialize()` always runs and immediately calls `fs.existsSync(this.credentialsPath)` even when `GCP_CREDENTIALS_PATH` is undefined.
  - Impact: Local/testing environments without a key file throw before the orchestrator can fall back to the mock BigQuery service, making `npm start` unusable unless GCP secrets are present.
  - Recommendation: Default `NODE_ENV` to `local`/`development` for CLI runs or gate initialization on `env.GCP_CREDENTIALS_PATH`; add validation with a clear error and unit tests around the fallback path.

Finding: Unbounded Busy Loop In Orchestrator
  - Severity: Medium
  - Location: src/orchestrator/etl.orchestrator.js:56-123
  - Issue: The main ETL loop is `while (true)` with no exit criteria or backoff when the Garoon API returns no data or errors.
  - Impact: When the offset has no pending items the function hammers Garoon continuously, consuming CPU and blowing through API rate limits.
  - Recommendation: Break once the newest offset is reached or sleep/backoff after N empty attempts; emit metrics so this condition is observable and add tests for the idle path.

Finding: PII Logged At INFO Level
  - Severity: Medium
  - Location: src/services/smarthr.service.js:25-37
  - Issue: `createCrew` logs the entire `crewData` payload (names, addresses, salaries) at INFO and repeats it in case of API failures.
  - Impact: Logs will contain sensitive personal information that Cloud Logging operators or attackers with log access can exfiltrate.
  - Recommendation: Remove or redact PII before logging; include only high-level metadata (requestId, processor type, etc.) and ensure secrets/PII are filtered at the logger.

Finding: Department Lookup Ignores Cache
  - Severity: Medium
  - Location: src/services/smarthr.service.js:83-110
  - Issue: `findOrCreateDepartment` fetches up to 500 departments from SmartHR for every request even though a `departmentCache` Map exists but is never consulted.
  - Impact: Processing even moderate batches causes many redundant API calls, slowing ETL runs and risking throttling.
  - Recommendation: Use the existing Map to cache lookups/creations, or prefetch once per run and reuse; add integration/performance tests that prove the cache prevents duplicate API calls.

Finding: No Automated Tests Cover Critical Paths
  - Severity: Medium
  - Location: package.json:8-19
  - Issue: Aside from a manual parser script, there are no unit or integration tests for the orchestrator, router, processors, or security-sensitive services.
  - Impact: Regressions like the broken router/offset tracker went unnoticed until runtime; there is no automated guardrail for routing, caching, or auth behavior.
  - Recommendation: Add Jest (or similar) suites that stub Garoon/SmartHR and verify routing, offset tracking, retry/backoff, and authorization edges; include negative tests for invalid requests to satisfy the checklist.

Questions: None
Residual Risks: Router, auth, and logging issues block safe deployment until addressed; no automated tests mean future regressions remain likely even after fixes.
