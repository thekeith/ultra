# CODEX Feedback for Ultra 1.0

## Scope & Approach
Reviewed the current `ux-fixes-20251228` branch with emphasis on the newly added database service, SQL editor tooling, and row-details UI. No automated tests were executed during this pass.

## Key Findings & Risks (ordered by severity)

### 1) Database connection dialogs never initialize the secret or database services
- **Where**: `src/clients/tui/client/tui-client.ts:8398-8447`, `src/services/secret/local.ts:288-305`, `src/services/database/local.ts:1003-1022`.
- **What**: `showNewDatabaseConnectionDialog` (and the edit/delete flows) call `localSecretService.set/delete` and `localDatabaseService.createConnection` without first invoking `localDatabaseService.init(...)`. The secret service throws `SecretService not initialized` until `localSecretService.init()` runs (which only happens inside `LocalDatabaseService.init`). Because the only callers of `localDatabaseService.init` are SQL-editor restore/query flows (`tui-client.ts:6836-6857`, `8173-8185`, `8207-8221`), creating or editing a connection before running a query crashes whenever a password or Supabase key is supplied.
- **Impact**: Users cannot save credentials (or Supabase service keys) unless they accidentally hit a path that initialized the database service earlier in the session, making the new connection workflow effectively unusable.
- **Recommendation**: Initialize the database service as part of client startup (or lazily within the connection dialogs before using secrets). At minimum, call `await localDatabaseService.init(...)` at the top of every connection-create/edit/delete path so the secret service is ready.

### 2) New connections are never persisted unless the service was initialized beforehand
- **Where**: `src/services/database/local.ts:88-134`, `src/services/database/local.ts:1110-1136`, `src/clients/tui/client/tui-client.ts:8398-8451`.
- **What**: `LocalDatabaseService.createConnection` always calls `saveConnections()`, but `saveConnections()` immediately returns when `connectionsLoaded` is `false`. That flag only flips to `true` inside `LocalDatabaseService.init`. Because the connection dialogs never call `init`, `connectionsLoaded` remains `false`, `workspaceRoot` stays `null`, and the JSON files under `~/.ultra/`/`<workspace>/.ultra/` are never written.
- **Impact**: Even if the secret calls above were fixed, every connection created before running a query disappears on the next launch (and project-scoped connections never persist at all because `workspaceRoot` is unset). Users believe their connections are saved, but all work is lost after restart.
- **Recommendation**: Make `createConnection/updateConnection/deleteConnection` either auto-initialize the service (and set `workspaceRoot`) or ensure every caller initializes it first. Consider removing the `connectionsLoaded` guard or defaulting it to `true` after an in-memory creation so saves cannot silently no-op.

### 3) SQL LSP configuration never succeeds because cached passwords only exist after a live connection
- **Where**: `src/clients/tui/elements/sql-editor.ts:187-202`, `src/clients/tui/client/tui-client.ts:7791-7828`, `src/services/database/local.ts:286-295`.
- **What**: Selecting a connection in the SQL editor immediately calls `configureSQLLanguageServer`, but that function insists on `localDatabaseService.getCachedPassword(connectionId)`. Passwords are cached only during an active `connect()`, and the SQL editor does not connect when the user changes the dropdown—it only connects later when executing a query. There is no second call to `configureSQLLanguageServer` after the query triggers a real connection, so the method always returns early with `“no password cached”`.
- **Impact**: Postgres-language-server is never configured with host/user/password, meaning schema-aware completions, hover, and diagnostics never activate even after the user connects. The flagship “database-aware LSP” feature is effectively dead.
- **Recommendation**: Either fetch the password directly from the secret service when configuring the LSP (falling back to prompting the user) or call `configureSQLLanguageServer` again once `connect()` succeeds. Do not gate configuration solely on `cachedPassword`.

### 4) Row Details panel hardcodes the `public` schema for every table
- **Where**: `src/clients/tui/client/tui-client.ts:7990-8038`, `src/clients/tui/client/tui-client.ts:8060-8099`.
- **What**: When the user opens row details, the client always calls `describeTable(connectionId, 'public', tableName)` and later builds `UPDATE`/`DELETE` statements using `"public"."<table>"`, even though `parseTableNameFromSql` strips whatever schema the query actually referenced.
- **Impact**: Editing or deleting a row from any schema other than `public` either targets the wrong table or fails with `relation does not exist`. Primary keys also fail to load for non-`public` tables, making optimistic updates impossible.
- **Recommendation**: Preserve the schema when parsing the `FROM` (or store it with the query result metadata) and pass it through to `describeTable`, `setRowData`, and the generated SQL. Until then, block row editing when the schema cannot be determined rather than issuing incorrect SQL.

### 5) Database connection events announce “connected” before the backend actually connects
- **Where**: `src/services/database/local.ts:168-194`.
- **What**: `LocalDatabaseService.connect` sets `status = 'connecting'` but immediately emits a connection-change event with `type: 'connected'`. Only afterward does it attempt the actual backend `connect()`, emitting another `'connected'` event if the call succeeds (and `'error'` otherwise).
- **Impact**: Subscribers (TUI overlays, ECP clients, telemetry) are told a connection is established before credentials are validated. UI badges will flip to “connected” briefly even if the connection later fails, and ref-counting logic may reuse a connection that has not finished establishing yet.
- **Recommendation**: Emit a distinct `'connecting'` event when entering that state, and only emit `'connected'` after `backend.connect()` resolves. This keeps UI state and LSP configuration in sync with the real connection lifecycle.

## Coverage & Testing Gaps
- There are no integration tests covering the connection dialogs, secret-storage flows, or persistence of `connections.json`, so the two regressions above slipped through unnoticed.
- SQL-editor tests exercise neither the LSP configuration path nor row-details editing. A simple end-to-end test that opens a SQL editor, assigns a schema-qualified table, and edits a row would catch the schema hardcoding immediately.
- Database-service unit tests only cover the in-memory service; they do not validate event emissions or the `connectionsLoaded` guard.

## Suggested Next Steps
1. Initialize `localDatabaseService` (and therefore `localSecretService`) during client startup or at the top of every connection-management action so persistence and secret storage work.
2. Rework SQL LSP configuration to fetch credentials independently of cached passwords and re-run configuration whenever a connection actually succeeds.
3. Track the schema associated with query results and use it throughout the row-details panel (describe, update, delete).
4. Fix the connection-change event semantics and add regression tests so UI and clients can trust the events they receive.
