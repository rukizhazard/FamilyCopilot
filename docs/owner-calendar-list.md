# Owner-only Logic App calendar-list experiment

## Approved boundary

On 15 September 2026 the owner approved reusing the already authorized Outlook connection for a **separate, owner-only, list-available-calendars experiment**, including one controlled live verification. This does not authorize event reading, meeting changes, mail, sharing, unattended refresh, family/child account access, or a production integration. It supersedes the blocked new-app path for this experiment only. No PKCE registration is retried.

The [workflow factory](../infra/calendar-list.js) and [operator helper](../scripts/calendar-list.js) use Node built-ins only. The original command-only slice below added no local web UI or listener. The later [local-owner UI increment](#local-owner-ui-increment) is separately approved and documented below; the original deployment and verification record remains historical evidence, not a claim that the new output contract is deployed.

Fixed Azure scope:

- Subscription: `609bbde3-d152-4d7d-a12b-005e38ac4f27`
- Tenant: `72f988bf-86f1-41af-91ab-2d7cd011db47`
- Resource group: `vdi-prebuilt-dte`; region: `eastus`
- New workflow only: `familycopilot-calendar-list-dev`
- Reference only: `familycopilot-office365-dev`
- Read-only preservation check: `familycopilot-invitations-dev`, Disabled, SAS Disabled, delivery off

There are no connection writes, new app registrations, credentials, databases, Functions, Storage accounts, role assignments or changes to Cosmos/unrelated resources. The existing connector's grant may support operations broader than this workflow. Reuse neither reduces nor expands that provider grant; the deployed workflow itself exposes only the fixed list operation.

## Verified provider contract

Official [Office 365 Outlook documentation](https://learn.microsoft.com/en-us/connectors/office365/#get-calendars-(v2)) identifies `CalendarGetTables_V2`, **Get calendars (V2)**, as listing available calendars with `value` entries containing `id`, `name`, and `owner`. Connected status alone is not proof of runtime access. Shared-calendar limitations, mailbox support and Conditional Access may affect results.

On 15 September 2026, read-only ARM metadata for the approved eastus managed API confirmed:

- Operation metadata: `office365/apiOperations/CalendarGetTables_V2`, production revision 2, not pageable.
- Exported Swagger: `office365?api-version=2016-06-01&export=true`.
- Exact Swagger path: `/{connectionId}/codeless/v1.0/me/calendars`, method `get`.
- ApiConnection supplies the connection prefix; the action path is `/codeless/v1.0/me/calendars`.
- Internal integer query parameters `top` (provider default 256) and `skip` (default 0) are present. This workflow fixes `top=100`, `skip=0`; no page following or workflow retries.

The helper checks this metadata before creation. The result is **at most one bounded list response**, not a complete inventory or proof of ownership. A zero count means no entries returned, not no calendars or a free schedule. No calendar time range is checked and **no events are requested**.

## Security and data handling

The Request endpoint requires the exact tenant issuer, current previously approved operator `oid`, Azure CLI `appid`, and ARM `aud`. The helper checks these against the preserved invitation policy before creating or invoking anything. Azure validates token signature and claims; local JWT decoding is only a sanity check. No valid alternate-user token is acquired for testing.

SAS is disabled. Callback URLs are retrieved through ARM into memory only; the helper rejects signatures, unexpected hosts/regions, paths, query parameters, or redirects. Allowed callback API versions are the documented `2016-10-01` and the actual ARM-returned `2019-05-01`, verified before invocation. ARM bearer tokens are obtained from the existing CLI session into the Node process and never passed through shell arguments or to a browser. The CLI's existing credential cache remains managed by Azure CLI, not this helper. The CLI uses a subscription selector (it cannot be combined with a tenant selector); independent account and token checks enforce the tenant.

Only POST with an empty JSON object is accepted; callers cannot supply a mailbox, path, calendar, page size or downstream URL. The sole ApiConnection action uses GET, fixed queries, a one-minute action limit and `retryPolicy: none`. The helper uses 60-second CLI and 90-second HTTP deadlines, bounded response bodies, no redirects and no automatic retries. No recurrence, loop, background refresh or live UI exists. Platform/connector internal behavior is not claimed to be one physical Graph request.

Calendar labels, IDs and owner fields are processed only inside the connector/workflow. A secured Parse JSON step validates the bounded array and minimal `id`/`name` shape. The secured Response projects only status/count, `completeness: unknown`, `ownership: unverified`, and `eventsRead: 0`. Provider failures return fixed statuses and allowlisted HTTP status numbers, never error text. The operator prints only these projections. No calendar labels, IDs, addresses, raw provider bodies, tokens or callback URLs are saved to repository files or agent-visible logs.

Run history follows [Microsoft's secure-data guidance](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-securing-a-logic-app): Request outputs protected; ApiConnection inputs and outputs protected; Parse JSON and Response inputs protected (these types implicitly hide outputs and do not support explicit Secure Outputs). Content access is additionally restricted to `0.0.0.0-0.0.0.0`. There are no tracked properties or added analytics. These controls hide payloads; they do **not** mean Azure Logic Apps has no service-managed storage or that administrators cannot edit the workflow. Production retention/deletion and privileged-administrator threat modeling remain separate reviews.

## Reusable operator modes

From the repository root, use `node scripts/calendar-list.js` with exactly one mode:

| Mode | Behavior |
| --- | --- |
| `check` | Read-only account, exact caller policy, connection, invitation, name-collision and metadata checks. Never lists calendars. |
| `deploy` | Repeat preflight and collision check, issue one conditional PUT (`If-None-Match: *`) to the fixed workflow resource, then verify the deployed disabled contract. No overwrite/update/resume mode. Do not run concurrent deployment operators. |
| `status` | Read-only safe state and contract match. Never lists calendars or retrieves run payloads. |
| `verify` | Require the exact deployed contract and Disabled state; temporarily enable; test anonymous and invalid-token denial first; recheck access; issue at most one authenticated empty POST; disable in `finally` and clear the in-process token. Each later invocation requires owner authorization. |
| `--help` | Local usage, no Azure calls. |

Verification stops unless each unauthorized probe returns 401 or 403. HTTP 400/404/429/5xx are not treated as proof of authorization enforcement. The exact claim policy is checked structurally, but cross-user/tenant denial with valid alternate credentials is not tested. No broad permission is requested to obtain such credentials.

If enable has an ambiguous result, disable is still attempted once. If disable fails, verification fails rather than reporting a completed success. A process kill or lost network can prevent cleanup; inspect `status` and have the operator disable **only this new workflow** in Azure before further work. Disable stops new triggers but is not claimed to cancel an already running action. Repeated invocations, service updates, or any recovery deployment are not automatically authorized.

The helper does not support production concurrent callers, rate limiting, synchronization or revocation across a persistent store. It rechecks the contract and preserved resources immediately before live access and emits no success after cleanup failure. Future event import still requires calendar selection, represented-person/disclosure/audience choices, applicable guardian authority and access-summary confirmation.

## Validation record

- Baseline: 100 offline tests passed; existing uncommitted files preserved.
- New mocked tests: [test/calendar-list.test.js](../test/calendar-list.test.js), including exact resource/path boundaries, protected history, collision handling, metadata validation, caller policy, redaction, bounded transport, denial ordering, cleanup and revocation guards.
- Read-only Azure preflight passed. One conditional resource PUT created the workflow Disabled; a separate read confirmed the exact deployed definition, caller policy, connection reference and history protections. Existing connection/invitation resources matched their pre-deployment snapshots.
- The first verification stopped **before enabling or invoking** because callback validation expected the documentation's older API version. Read-only callback contract inspection confirmed ARM returns `2019-05-01`; the helper and mocked regression were corrected without redeploying or changing authentication.
- Controlled live verification then completed: anonymous POST **401**, invalid bearer POST **401**, followed by exactly one authenticated POST returning **listed, count 3**. The workflow requested no events. Completeness is **unknown** and ownership **unverified**; no names, calendar IDs or owner addresses were exposed to the operator output or agent.
- `finally` disabled the new workflow and confirmed Disabled by a separate read. The preserved connection and invitation resources matched their pre-verification snapshots. No connection reset, invitation invocation, mail, OAuth registration, event request or unrelated resource write occurred.
- The full offline suite passed **115 tests** before deployment and again before live invocation. The final expanded suite passed **118 tests, 0 failures**, including 18 new list-only tests. `git diff --check` and editor diagnostics passed. Final read-only Azure status confirmed **Disabled**, **SAS Disabled**, exact contract match, connection **Connected**, and invitation **Disabled** (its delivery-off guard also passed).
- No browser validation applies to this command-only slice. Parent usability, shared-calendar completeness, child-account feasibility and production readiness remain unverified.

## Local-owner UI increment

### Approval and current outcome

The owner subsequently explicitly approved a local owner/developer interface, **Load → Select → Local summary, no events**, using the same exact cloud scope above. Only `familycopilot-calendar-list-dev` may be updated. The existing connection is preserved; the invitation workflow is never invoked or changed. No cloud registration, hosting, Storage, Cosmos, Functions, persistence, mail or unrelated resource work is included.

The [owner helper](../scripts/owner-calendar.js) exposes only `status` and `update` CLI modes. Neither can list calendars. Real loading uses the acknowledged local page; the separately authorized [one-shot verification client](../scripts/verify-owner.js) traverses that same loopback proxy, without displaying or logging its response payload. The original helper remains historical v1-only tooling, not an alternate updater.

**Executed cloud outcome, 15 September 2026:** one authorized standard PUT updated the exact Disabled v1 contract to v2. The update returned `updated_disabled`, `existingResourcesUnchanged: true`, `atomicCompareAndSwap: false`, and `calendarRequestMade: false`. Immediate and independent readback confirmed:

| Safe field | Observed value |
| --- | --- |
| Workflow state / contract | Disabled / local-owner-list-v2 |
| SAS disabled | true |
| Connection Connected | true |
| Invitation Disabled / delivery off | true / true |
| Calendar request made by status/update | false |

The earlier update stopped before writing because ARM supplied no ETag. That requirement was **our tooling assumption**, not a provider authorization/privacy rule. Official [Create Or Update](https://learn.microsoft.com/en-us/rest/api/logic/workflows/create-or-update?view=rest-logic-2019-05-01) and [Get](https://learn.microsoft.com/en-us/rest/api/logic/workflows/get?view=rest-logic-2019-05-01) references were checked again: the supported operation is standard PUT; neither documents an `If-Match` precondition or using the returned `properties.version` as a CAS token. The approved fix uses that standard PUT, no guessed headers/version substitution, no delete/recreate and no arbitrary resource/body update.

**Concurrency limitation:** [local operation exclusion](../scripts/owner-operation.js) reserves loopback port **18002** while a live load (including independent disable cleanup) or update runs. It acquires before credentials and releases on completion/process exit, without data files or stale lockfiles. A conflicting reservation refuses work. It coordinates cooperating processes on this machine only, not Portal/other-machine writers or malicious local processes. The old live server was identified by exact command/cwd and gracefully stopped before deployment; the refreshed server participates in the lock. Keep other deployment operators inactive. The final GET immediately precedes the PUT, but an external ARM writer can still race that gap: **this is not atomic compare-and-swap**. Unknown drift is still refused, with no automatic retry or overwrite repair.

**Live validation:** the first authorized proxy request did not pass its local preservation check. Read-only [bounded metadata diagnostics](../scripts/diagnose-owner.js) showed the run and its list, validation, label projection and response actions all Succeeded, with no failed/timed-out action; no protected input/output links were followed. The connection's `changedTime` advanced during that successful connector run. Microsoft [documents that field as the last-connection-change timestamp](https://learn.microsoft.com/en-us/azure/templates/microsoft.web/connections). The previous whole-resource equality check treated that timestamp advance as revocation. The corrected post-invocation comparison permits only a valid nondecreasing `changedTime`, keeping every other connection field (including unknown fields, identity, parameters, status, tags and ETag) and the entire invitation resource exact. Pre-invoke and deployment comparisons remain fully strict. This is not permission to ignore other drift or claim connector runtime metadata never changes.

After explicit approval for **one additional** live E2E and restarting only the owner backend, the verification runner reported **passed, exit 0**. The verifier requires a valid v2 proxy response, independent Disabled/contract readback, preserved resource-contract comparison, local-session clear/revocation and idle proxy before reporting success. **Reporting limitation:** the runner returned only that success summary, not its full booleans/count JSON; the current returned calendar count could not be recovered and is not inferred from the historical count of 3. No further request was made to recover it. A direct final safe status separately confirmed the table above. Both verification sessions were cleared; real payloads were never viewed through browser tools or printed. The real page is ready idle, not a synthetic handoff.

### Local handoff

- VS Code task **FamilyCopilot: local owner calendars**, defined in [tasks](../.vscode/tasks.json), runs [the local server](../scripts/serve-owner.js) at **http://localhost:8002/**. Open that exact URL in external Edge. Only loopback `127.0.0.1` is bound; exact Host is `localhost:8002`. Ports 8000 and 8001 are untouched. Node 18.17+ and a current browser are required; validation used Node 20.20.1. No build or dependency install is needed.
- The main [fictional demo](../index.html) has an owner-calendar link. The owner server also exposes it at `/demo`. This is navigation, not data sharing: real selections never enter mock activity/schedule state.
- Reload any old page, acknowledge the developer's already authorized account, then explicitly Load. Successful results appear only after verified workflow disable. All calendars start unchecked. Select, Review local selection, Change selection and Clear/cancel remain local. There is no event-access confirmation, invitation or registration control.
- One load per page, one process-wide request including cleanup; no polling, retries or token refresh. A fresh page permits another deliberate request, not an automatic retry. The 30-minute CSRF session lifetime, maximum 32 page sessions and 32 connections bound local resources.
- **Check local cleanup status** reads only process memory, not Azure. Startup, page navigation and status do not acquire credentials or list anything. Live calendar labels must be viewed only by the owner externally, never through agent tools or screenshots.

### Security, output and cleanup contract

[The v2 factory](../infra/calendar-list.js) retains the v1 definition as the exact prior contract. The only new data operation is a secured Select projecting validated `id` and `name`, followed by the secured response. Exact issuer/oid/appid/aud/SAS policy, connector, verified `/codeless/v1.0/me/calendars`, `top=100`, `skip=0`, empty request schema, no retries, bounded list validation and protected history remain unchanged. Official Outlook and Logic Apps secure-data documentation were rechecked; Select supports secure inputs/outputs, while Parse JSON and Response use secure inputs with implicit output protection.

The updater requires the exact existing Disabled v1 resource, expected location/tags/definition/parameters/access policy, known service envelope, unchanged preserved-resource snapshots and an identical final read. It issues at most one exact standard PUT, refuses 409/412 without retry, and verifies Disabled v2 plus preserved resources afterward. The update-only transport rejects enable/invoke, arbitrary bodies, custom conditional headers, other resources and a second PUT. A v2 deployment is not accepted as a new v1 update target. Unknown configurable drift, wrong resource identity and collisions stop rather than being overwritten. The live deployment and full contract readback succeeded; authentication, SAS disabling, history protection and connector reference were not weakened.

The [loopback proxy](../scripts/serve-owner.js) allows exact files and exact POST API paths only. Mutations require exact Host, Origin, JSON content type and a per-page random CSRF token; forwarded-host/cross-site requests are refused. Bodies are bounded to 256 bytes and validated against each action's minimal schema. There is no wildcard CORS, arbitrary URL, mailbox, calendar ID, event route, CLI-mode selector or cloud resource selector. CSP, no-store, no-referrer and frame-denial headers apply. This is not authentication against a malicious local OS process and must not be published or forwarded to other people.

Existing Azure CLI credentials and callback URLs stay in process memory and out of browser responses, command arguments and logs. The asynchronous CLI calls are bounded and their output is captured, not echoed. Exact ARM read/write allowlists restrict the new backend. Provider payloads are bounded; IDs are checked then discarded, replaced with random UI keys. Owner objects and address-like text in labels are removed. The page uses text nodes only; provider content cannot authorize actions or become HTML. No raw provider error body is displayed or logged.

Cancellation, acknowledgement removal, clear, socket disconnect and server SIGINT/SIGTERM fence late results. After attempted enable, `finally` performs one independent disable and verifies Disabled before clearing credentials. Enable ambiguity, failed disable or failed verification suppress results and **stickily block further loads for the server process**, including new tabs. Normal request work is limited by a 240-second abort signal; each HTTP request is bounded to 90 seconds. Disable and its verification are independent of that signal and can take up to another 180 seconds. Browser waiting can end earlier and honestly reports unknown cleanup, not success.

Force-kill, process crash, power/network loss or platform behavior may prevent cleanup; disabling a workflow does not undo an already accepted run. Keep the backend running while cleanup is pending. If cleanup is failed/uncertain, the operator must inspect safe cloud status and disable **only `familycopilot-calendar-list-dev`**, verify its exact contract/Disabled state and preserved resources, and only then restart the local task. Do not reset the connector, touch the invitation workflow, blindly restart as a recovery proof, or retry listing to test cleanup. No automatic cloud recovery is included.

Browser state is tab-local, cleared on acknowledgement removal, clear, page exit and reload. No local file, browser storage, database, telemetry or request log stores calendar content. JavaScript memory clearing drops references; it does not promise physical memory erasure. Azure retains service-managed **protected run history**, including previously processed metadata. This is not zero persistence, cloud deletion, or a production retention implementation.

### Validation and remaining gates

- Original UI baseline/final: **118 → 147 passed**. This correction baseline: **147 passed, 0 failed**. Current full suite: **156 passed, 0 failed**; `git diff --check` and changed-code editor diagnostics passed. Offline suites include [contract/update/projection and full synthetic proxy traversal](../test/owner-calendar.test.js), [HTTP security/lifecycle](../test/owner-server.test.js), [UI state/escaping](../test/owner-ui.test.js), [local exclusion](../test/owner-operation.test.js), [safe verification](../test/owner-verification.test.js) and [metadata diagnostics](../test/owner-diagnostics.test.js). They cover absent ETag with standard PUT, drift/races, exact scope, single-write modes, lock conflict/release, strict pre-invoke versus narrow post-invoke timestamp handling, unknown/auth drift, cleanup, session revocation and nonleaking output. No real family data is used.
- The isolated **FamilyCopilot: synthetic owner browser review** task at **http://localhost:8003/** explicitly loads [synthetic fixtures](../browser-fixtures/owner.js), with no Azure backend. Live mode has no fixture route or fixture import. Synthetic review includes listed, empty, unavailable, revoked, slow/cancel and cleanup-failed scenarios. Cleanup-failed intentionally blocks that synthetic process; restart only that test task for another review.
- Original browser checks included slow cancellation and sticky cleanup failure across reload. This correction rechecked the isolated synthetic harness at **1280px desktop and 320px mobile**: keyboard acknowledgement/Load/selection, off-by-default checkboxes, summary focus, text-only injection, long-label fit, 44px targets, Clear cleanup and empty/unavailable/revoked states. The actual live page was then opened/reloaded **empty only**, with zero startup API requests, keyboard acknowledgement gating, no retained names and desktop/mobile fit. Browser tools never loaded a real calendar list. Synthetic evidence is distinct from the authorized live proxy checks above.
- Reusable verification: [verify-owner](../scripts/verify-owner.js) requires the explicit `--live-once` argument and fresh owner authorization for each future execution. It makes at most one proxy load, retains payloads only in memory, prints fixed booleans/counts and clears its session in `finally`. Capture its complete safe stdout directly for future limited-use checks; a summarized success is not evidence of a specific count. [diagnose-owner](../scripts/diagnose-owner.js) requires `--metadata-only`, reads at most the latest run and its action metadata, and never follows payload links or invokes anything.
- Only the approved workflow received one v1 → v2 deployment, plus temporary enable/disable for authorized live checks. No connector/invitation configuration writes, invitation invocation, events, mail, Cosmos/unrelated writes, commit or push. The connector did update its own lifecycle timestamp during use; do not call its full JSON immutable. Existing uncommitted work was preserved. External Edge live rendering, screen-reader announcements, parent usability, multiuser security, child-account feasibility and production readiness remain unverified. The next step is owner review at the real local URL, not another deployment or event import.