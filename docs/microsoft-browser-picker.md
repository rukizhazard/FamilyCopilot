# Own Microsoft calendar picker: browser PKCE milestone

## Scope and actual status, 15 September 2026

The parent explicitly approved changing this narrow milestone to **browser OAuth authorization code + PKCE**: sign in, confirm the account, list its own calendars, explicitly select, and review a local summary. This supersedes the earlier confidential-client architecture for this picker only. No event import, background synchronization, invitation acceptance, sharing, email sending or persistent connection is implemented. No Functions or Storage are needed for this slice. The original fictional demo is unchanged.

**Implemented and offline-tested; not configured for live sign-in.** The single approved registration attempt did not return success. No matching app was found in the subsequent exact-name lookup. The public client ID remains empty, so the real page disables sign-in without initializing MSAL or calling Microsoft. No fake fallback data appears on that page.

## Try in external Edge

- Install the lockfile dependencies with `npm ci --ignore-scripts`. Run the VS Code task **FamilyCopilot: live Microsoft picker** in [.vscode/tasks.json](../.vscode/tasks.json). It builds local bundles and starts the restricted loopback server. The original port-8000 demo server is independent and unchanged.
- Open **http://localhost:8001/** in external Edge. Use exactly `localhost`, not `127.0.0.1`, an alternate port or a forwarded public hostname. The server and application intentionally reject alternate origins. If WSL localhost forwarding is unavailable, fix that locally rather than exposing the server publicly.
- Currently expect **Not configured** with a disabled sign-in button. This is the correct fail-closed result, not a working live connection.
- After an organization-approved registration is supplied and verified, put only its public client ID in [picker/public-config.json](../picker/public-config.json), retain the pinned tenant and exact SPA callback, then rebuild. Do not paste secrets, certificates or tokens into the project or chat.
- The account holder, not agent/browser tools, completes Microsoft sign-in and consent in external Edge. Confirm the displayed account before pressing **Yes, list my calendars**. Check calendars, attest they represent your own schedule, then **Review selection**. This produces only a local summary; it does not import events or change provider permissions.
- **Disconnect and clear** clears the account, names and selection immediately, aborts pending list work and fences late responses. Reconnect is disabled until old authentication/cache cleanup settles. Close its popup if necessary; reload/close the tab if cleanup fails. Reload/navigation also clears application state. Microsoft sign-in cookies and consent are separate; use your organization's My Apps portal or administrator for consent removal.

## Public configuration and registration evidence

| Setting | Value |
| --- | --- |
| Initial audience | `AzureADMyOrg`, corporate home-tenant accounts only; no guest, personal, child or other-tenant support claim |
| Tenant | `72f988bf-86f1-41af-91ab-2d7cd011db47` |
| Client ID | Empty, unconfigured |
| SPA callback | `http://localhost:8001/redirect.html` |
| Delegated calendar permission | `Calendars.ReadBasic` (`662d75ba-a364-42ad-adee-f5f880ea4878`) |
| Graph resource | `00000003-0000-0000-c000-000000000000` |
| Credentials / implicit grants | None / disabled |

[scripts/register-picker.js](../scripts/register-picker.js) is operator-only. Each invocation requires explicit approval and the exact subscription `609bbde3-d152-4d7d-a12b-005e38ac4f27` and existing group `vdi-prebuilt-dte`. It verifies tenant/subscription/group, attempts one uniquely named tenant-scoped application creation with only the SPA redirect and one delegated calendar permission, then reads back and verifies public settings. An app registration is tenant-scoped, not an RG resource. It does not create service principals, credentials, consent grants, roles or hosting, and never modifies existing resources. No retry or policy bypass exists.

Actual attempt:

- Generated name: `FamilyCopilot-own-picker-b9ead583-0042-4594-868b-f0592d57eedb`.
- Stopped at create; safe code `AzureOperationFailed`; no object ID returned. This generic error **does not establish** whether the cause was policy, CLI arguments, authorization or networking. Existing command-log inspection did not yield a safe cause for this exact attempt.
- One subsequent read-only exact-name lookup returned `matchingApplications: 0`. Creation was not retried. This is point-in-time evidence, not a tenant-wide inventory claim.
- No hosting deployment, Functions, Storage, credentials, real account-holder OAuth, calendar listing, event access or mail send occurred through tools. Static deployment was not attempted while registration/configuration remained unresolved.
- Existing resources were rechecked read-only: `familycopilot-office365-dev` **Connected**; `familycopilot-invitations-dev` **Disabled**; SAS **Disabled**; `deliveryEnabled=false`; caller policy count **1**. No reset, recreation, invocation or modification. No Cosmos access or changes.

Next unblock: have the tenant app-registration administrator investigate that exact attempted name/operation and supply or approve the organization's permitted registration process. A new create attempt needs its own approval; do not automatically repeat the previous one. The existing secret/certificate restrictions are **not** a reason to reject a credential-free SPA, and no new architecture question is required for this already approved slice. Live consent and mailbox availability remain unverified.

## Runtime privacy and safety contract

- [picker/msal-adapter.js](../picker/msal-adapter.js) uses locally bundled, exact-pinned MSAL Browser **5.21.0**, with MSAL Common **16.14.0**; build-only esbuild **0.28.2**. [package-lock.json](../package-lock.json) pins integrity hashes. Installation used `--ignore-scripts`; no install scripts ran. npm audit reported zero known vulnerabilities, not a security certification. Both libraries are MIT; the build retains notices and the MSAL license. No remote CDN, framework or backend.
- MSAL owns PKCE, state, nonce and the popup response bridge. Application code does not implement OAuth or parse Graph access-token JWTs. It sanity-checks SDK tenant, home/local identity, issuer, audience, expiration and granted scopes; Graph remains the access-token validator. Stable identity, not mutable email, binds the session. Identity changes fail closed.
- Token cache is `memoryStorage`. Installed v5 source uses session storage for temporary authentication metadata; do not claim zero Web Storage activity during real authentication. The popup path keeps tokens in memory. MSAL standard scopes include `openid`, `profile`, `offline_access`; a refresh token may be issued but this application never calls silent acquisition, refresh or background SSO. Native/platform broker, SSO verification and server telemetry are disabled; logging callbacks discard messages. Identity-provider cookies/records are outside app retention control.
- Only explicit identity confirmation invokes **GET `/v1.0/me/calendars`**, selecting `id,name,owner,canShare`. Provider consent for `Calendars.ReadBasic` is broader than calendar names and permits basic event reading; the UI discloses this. The application calls no event/free-busy endpoints, `$expand`, write API or assistant.
- Own-calendar eligibility requires provider `canShare=true` (documented as creator-only) **and** owner address matching the SDK account username. Email matching is an additional conservative filter, not the authorization boundary. Shared/unknown/alias mismatches are discarded before UI projection. Some own calendars can be withheld; the UI explains why without revealing another owner's labels. Ownership alias resolution is not implemented.
- Pagination permits only the exact HTTPS Graph origin/path and allowlisted `$select`, `$top=50`, `$skip`/`$skiptoken`; no credentials, fragments, duplicate keys, expansion, endpoint changes or redirected bearer requests. Unknown continuation shapes fail closed rather than being guessed. Maximum **10 pages, 500 calendar records, 128 KiB per page and 20 seconds for the list operation**. The streamed body is bounded before JSON parsing. Loops, duplicates, malformed responses, unsafe next links, partial failures, bounds and 401/403/429 discard all accumulated state. No automatic retries.
- List freshness is **five minutes**, checked when the tab regains focus/visibility and before every selection/summary action. Token expiration also invalidates state. No background timer refreshes data; the displayed fetch timestamp is a snapshot, never a promise of current completeness. No time range or event was checked, so schedule compatibility and conflicts remain unknown.
- Every dynamic label uses text nodes. No untrusted HTML, styles or URLs are inserted. No raw provider errors, tokens, calendar labels or identifiers are logged. Disconnect fences pending auth, pagination, selection and cleanup. Cleanup failure prevents reconnect and requests a tab reload.
- [scripts/serve-picker.js](../scripts/serve-picker.js) binds only loopback, accepts only the fixed Host, GET/HEAD and seven allowlisted paths, rejects arbitrary paths/query strings, logs no requests, and serves `no-store`, CSP, no-referrer and nosniff headers. Auth explicitly uses fragment response mode. MSAL's dedicated callback has **no COOP header**. Do not replace this with a public development server or broad repository file serving.
- Browser-held tokens remain exposed to compromised same-origin JavaScript/extensions and the user's device. This is an explicitly approved limited experiment, not production security readiness. Deployment would require separately reviewed HTTPS origin/redirect/header configuration; this build intentionally supports only the local origin.

## Executed validation and limitations

Baseline: **72 passing tests**. Expanded `node --test`: **100 passing, 0 failing**, including the inert fixture discovery entry. Coverage includes identity/scope/expiry, explicit account/list gates, empty/partial/denied/admin/popup/401/403/429 states, conservative ownership, hostile pagination, byte/item/page/time bounds, disconnect during login/initialization/fetch, reconnect cleanup fencing, stale summaries, source isolation and allowlisted server/registration contracts. Tests use synthetic responses, no Microsoft data. Both live and synthetic builds, `git diff --check` and npm audit passed.

Browser checks used the clearly labeled **SYNTHETIC TEST HARNESS**, built separately from [browser-fixtures/picker.js](../browser-fixtures/picker.js). It is not in the live bundle or live server allowlist. Keyboard activation, identity confirmation, checkboxes, focus retention, selection/summary, deselection/disconnect, labels and textual uncertainty were observed. An HTML-shaped calendar name rendered literally with no injected image; foreign labels were absent. Long names and summaries fit the observed narrow browser layout, with visible buttons above 44 CSS px.

**Viewport limitation:** requested 1280px and 320px sizes were not reliably honored by the embedded browser; a later measured viewport was 480 CSS px and hidden-tab state prevented further native click/keyboard actions. Later synthetic checks used DOM event dispatch, not claimed as additional native input coverage. True desktop/320px external-Edge checks, screen-reader announcements and parent usability approval remain outstanding. No real OAuth/Graph runtime, tenant consent, mailbox support or deployed-host behavior was tested by tools.

## Official references checked

- [MSAL initialization](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization), [caching](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/caching), [v5 migration](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/v4-migration), [redirect bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge).
- [SPA code + PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app), [create application](https://learn.microsoft.com/en-us/graph/api/application-post-applications?view=graph-rest-1.0).
- [List calendars](https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0), [calendar properties](https://learn.microsoft.com/en-us/graph/api/resources/calendar?view=graph-rest-1.0), [permission reference](https://learn.microsoft.com/en-us/graph/permissions-reference#calendarsreadbasic).

Parent review, Google child-account feasibility, event-import consent/redaction, cross-family authorization, persistent credentials/data, invitation lifecycle and deployment readiness remain distinct future gates. No commit or push was performed.