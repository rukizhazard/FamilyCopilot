# Live adult onboarding: preflight and blocker

## Latest approved change: browser-only own-account picker

The parent subsequently explicitly approved browser authorization code + PKCE for **sign-in → own calendar list → selection → summary**, without event import or sharing. The confidential-client discussion below is historical for the broader invitation service, not a blocker to this credential-free SPA. This is an approved scoped architecture change, not a silent workaround. No Functions or independent Storage were added for the picker.

The separate picker is implemented with locally bundled MSAL and offline security tests. One approved SPA registration attempt stopped with safe code `AzureOperationFailed`; a subsequent read-only exact-name lookup returned zero applications. No app ID was configured, no creation retry or hosting deployment occurred, and no real OAuth/calendar access was performed through tools. The UI fails closed with sign-in disabled. **Do not infer the underlying cause from this generic error or reuse the historical certificate restriction as its explanation.**

See [the current picker record](microsoft-browser-picker.md) for the exact generated name, public configuration, external Edge instructions, dependency/cache review and browser limitations. The expanded suite passed 100 tests. Existing connector/workflow status was rechecked read-only and is unchanged: Connected; workflow/SAS Disabled; delivery false; one caller policy. The remaining next step is organization-approved registration resolution; this already approved architecture does not need another gate question.

## Historical server-side preflight

## Authorization and selected outcome

On 15 September 2026 the parent explicitly approved implementing and deploying Azure Static Web Apps (SWA) + Functions, independent Storage for invitation state, and an Entra app registration. The intended increment is an authenticated adult invitation lifecycle and a separate calendar picker/consent surface, **without importing events**. Real email sending remains deferred until the complete flow is reviewed. Parent usability approval and actual tenant/account policy are not implied by implementation approval or automated tests.

Historical status at that preflight: **blocked before cloud creation**, not a deployed live milestone. The fictional UI and backend absence were unchanged. The newly approved separate browser picker is described above; no synthetic success is substituted on its real page.

## Verified read-only evidence

Scope: subscription `609bbde3-d152-4d7d-a12b-005e38ac4f27`, existing resource group `vdi-prebuilt-dte` in `eastus`, tenant `72f988bf-86f1-41af-91ab-2d7cd011db47`.

| Check | Observed result | What this does not establish |
| --- | --- | --- |
| Subscription / group | Enabled; group readable | Permission to create every resource or role assignment |
| Microsoft.Web / Microsoft.Storage | Registered | SKU, region, quota, RBAC, or deployment-policy approval |
| Matching FamilyCopilot resources | Existing workflow and dedicated Outlook connection | Any functioning onboarding website |
| Exact proposed app-name lookup | No `familycopilot-adult-onboarding-dev` registration returned | Global absence of similarly named registrations or creation permission |
| Authorization policy | `defaultUserRolePermissions.allowedToCreateApps: true` | Consumer/multitenant approval, credentials, Graph consent, or runtime sign-in |
| Default app-management policy | `isEnabled: true` | Complete organization policy or a policy exemption |
| New password credentials | `passwordAddition`, `customPasswordAddition`, `symmetricKeyAddition` all `enabled` | Permission to create a secret by another mechanism |
| Certificate restriction | `asymmetricKeyLifetime: enabled`, `maxLifetime: PT0S` | A usable certificate lifetime |
| Restriction applicability | Credential rules apply after `2000-01-01T00:00:00Z`; `excludeActors: null` | An app-specific/admin-approved exception |
| Preserved mail workflow | `Disabled`; SAS `Disabled`; `deliveryEnabled: false`; policy count 1 | Runtime caller-policy enforcement or mail delivery |
| Preserved Outlook connection | `Connected` | A tested send or calendar consent |

Microsoft documents enabled password-addition restrictions as preventing new client secrets and certificate lifetime restrictions as maximum ISO 8601 durations. `PT0S` is zero seconds. This is a concrete blocker to the standard secret/certificate-backed confidential-client path, despite the separate permission to create an application object. No write was attempted to test enforcement, no exemption was sought, and no tenant policy was changed.

**No new Azure resources, registrations, credentials, role assignments, storage data, or deployments were created.** The existing connection was not reset. The workflow was not activated/invoked. No email, calendar list, event import, or account-holder OAuth flow was attempted. Existing Cosmos DB and unrelated resources were untouched. No commit or push occurred.

## Architecture facts checked against current Microsoft documentation

- [SWA API support](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions): managed Functions do not support managed identity, Key Vault references, or App Service authentication token management. They provide HTTP triggers only; do not assume they can supply a scheduled retention job.
- [SWA plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans) and [linked Functions](https://learn.microsoft.com/en-us/azure/static-web-apps/functions-bring-your-own): linking a separately deployed Functions app requires **Standard**, not Free. Linked backend authentication must prevent direct-endpoint bypass. The linking documentation requires public network accessibility; private endpoints/IP restrictions cannot simply be assumed compatible. Costs and the exact Function SKU/region remain unverified; nothing was provisioned.
- [SWA custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom): custom registration requires Standard and documents server-side secret/certificate configuration. Do not deploy a default secret-based setup under the observed policy.
- [SWA user information](https://learn.microsoft.com/en-us/azure/static-web-apps/user-information): the API `x-ms-client-principal` lacks provider `claims`. Browser-supplied claims cannot repair that trust boundary. SWA `userId` is app-specific and changes after removal/re-addition.
- [Entra registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app): organizational, multitenant, and personal account audiences are separate registration choices. This corporate tenant's permission for the intended audience has **not** been established. No guest accounts or external invitations were created to work around it.
- [MSAL Node authorization code flow](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests): use the supported SDK for server-side code exchange. Any implemented flow must independently bind state, PKCE, nonce, exact redirect URI, session and account, with replay protection and safe logging. SDK sample logging must not be copied into this application.
- [ID token claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference): `email` and `preferred_username` are mutable and unsuitable for authorization. Bind invitations/audiences to authenticated stable subjects, not text entered in an email box. Adulthood/guardian authority is a separate application requirement.
- [Graph list calendars](https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0): the least-privileged delegated permission is `Calendars.ReadBasic` for work/school and personal accounts, not automatically the broader `Calendars.Read` in the earlier proposal. No event endpoint is part of this milestone.
- [Read default app-management policy](https://learn.microsoft.com/en-us/graph/api/tenantappmanagementpolicy-get?view=graph-rest-1.0), [secret/certificate policy semantics](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/tutorial-enforce-secret-standards), and [certificate restriction fields](https://learn.microsoft.com/en-us/graph/api/resources/keycredentialconfiguration?view=graph-rest-1.0): distinguish registration permission from credential policy. Reading policy does not authorize changing it.

## Concrete unblock request

Ask the tenant application/identity administrator to confirm:

1. Whether this adult family-onboarding application is permitted in this tenant, and the exact supported account audience, including whether personal Microsoft accounts and other organizations are allowed.
2. The supported confidential-client credential path under the observed restrictions. A managed-identity federated client assertion may be a policy-compliant candidate, **not a verified or selected workaround**. Its tenant support, registration permission, SDK flow, and hosting trust boundary must be verified before creating resources. Do not weaken tenant policies or silently switch to a public SPA.
3. Any required app-registration process, ownership/security review, and delegated-consent/admin-approval requirements for the later picker. A policy-approved existing registration may be supplied through the normal operator configuration; no secrets should be pasted into chat.

Then resume narrow preflight, confirm the permitted account/credential design and deployment permissions, and only then create the scoped resources. Approval already covers the stated architecture; the missing evidence is tenant permission and a usable credential path, not another request to approve the same architecture.

The live implementation must still cover hashed expiring authoritative invitation state, verified identity/audience binding, non-consuming GETs, explicit authenticated POST acceptance, origin/CSRF protection, revocation/concurrency fencing, bounded retention and a send ledger/rate limits. Acceptance must not grant calendar access. Picker choices remain off by default and require represented-person/disclosure/audience review; event import stays disabled. The workflow must remain disconnected from sending until a separate reviewed first-send approval.

## Reusable verification and results

[scripts/onboarding-preflight.js](../scripts/onboarding-preflight.js) accepts `check` with explicit `AZURE_SUBSCRIPTION_ID` and `AZURE_RESOURCE_GROUP`; `--help` explains use. It pins the approved scope and expected tenant, reads only account and two policy endpoints, stops on denial, disables dynamic CLI extension installation, captures errors privately, and emits a fixed field projection. Unknown policy fields/exemptions require review, never imply approval. Exit 1 means invalid input/read failure; exit 2 means review is required. There is deliberately **no deployment mode and no automatic approval result**. Use the existing [mail status helper](../scripts/invitation-infra.js) for independent safe delivery-state checks; never run `deploy`/`resume` against the existing connected resources.

The live evidence above was obtained with direct read-only Azure checks before adding the reusable helper. The helper itself is validated offline with injected synthetic responses, not claimed as a separately executed live deployment preflight. Run the repository suite with `node --test`; no server or dependency installation is needed. Baseline: 64 passing tests. The initial summarized claim that the working tree was clean was incorrect; a direct Git check showed prior modified/untracked prototype and infrastructure files, which were preserved. This increment changes only the README, email status documentation, this record, and the new preflight helper/tests.

Executed post-change validation: **72 tests passed, 0 failed** (52 app, 12 email infrastructure, 8 onboarding preflight); `git diff --check` and the helper's offline `--help` passed. Editor diagnostics reported no errors in the changed files. No UI changed in this increment, so no new browser or parent usability validation was performed. Offline tests do not establish tenant approval, identity verification, a live invitation lifecycle, or deployment readiness.