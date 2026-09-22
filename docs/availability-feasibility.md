# Two-person Free/Busy feasibility

> Historical metadata-only milestone. The later explicit bounded implementation,
> deployment and verification approval supersedes the pending-input/approval statements
> below. See [current owner availability implementation and runtime blocker](owner-availability.md).
> The owner supplied both actors and the fixed range/purpose. Deployment succeeded;
> the single verification stopped at protected target validation before getSchedule.
> Do not describe the feature as live-successful or ask for those inputs again.

## Approved increment and outcome, 15 September 2026

The owner agreed to verify whether the existing Logic App connection supports availability **without reading the other person's data**. The prototype goal is at least two people's schedules, not several calendars belonging to one person. This increment is official-documentation research, read-only Azure metadata inspection, a reusable capability check and offline tests only.

**Outcome: a viable candidate exists through the existing Office 365 Outlook `HttpRequest` operation targeting Graph `POST /v1.0/me/calendar/getSchedule`. Runtime authorization and actual two-person availability remain unverified.** No mailbox schedules, calendar lists, events, directory searches, connection tests, workflow invocations or run payloads were requested. No deployment, enable/disable, registration, permissions, mail or persistent data integration was added. The existing local owner page and fictional demo are unchanged.

The owner's report/screenshots describe three own calendars and Parent B under a team grouping, with Free/Busy access only. This is user-reported Outlook context, not proof of delegated sharing, a Graph-readable custom calendar, verified email identity or connector authorization. No loaded real browser page was inspected. Do not guess an address or search the directory to resolve the name.

## Official API comparison

Sources below were retrieved on 15 September 2026.

| Route | Evidence and suitability | Limits / unresolved facts |
| --- | --- | --- |
| [Graph calendar: getSchedule](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0) | Read-only availability lookup despite HTTP POST. Accepts `schedules` SMTP addresses, `startTime`, `endTime`, and `availabilityViewInterval`. Returns one `scheduleInformation` per requested entity, including `availabilityView`, `scheduleItems`, possibly `workingHours` and per-person errors. Appropriate candidate for a bounded two-person grid. | Work/school delegated least privilege is **Calendars.ReadBasic**. Delegated personal Microsoft accounts are unsupported. Application support exists but is not proposed or authorized. Existing connector scopes and target-specific runtime permission are not established by metadata. |
| [Outlook Find meeting times (V2)](https://learn.microsoft.com/en-us/connectors/office365/#find-meeting-times-(v2)) | Existing connector action `FindMeetingTimes_V2` returns `meetingTimeSuggestions` and `emptySuggestionsReason`. Suitable for user-requested candidate slots, **not a full Free/Busy timeline**. | Constraints, duration, work hours and candidate limits affect suggestions. Empty suggestions cannot establish all-day busy or free status. Do not silently substitute this route for a full grid. |
| [Graph user: findMeetingTimes](https://learn.microsoft.com/en-us/graph/api/user-findmeetingtimes?view=graph-rest-1.0) | Documented API counterpart checks primary calendars and applies suggestion logic; least delegated work/school permission is **Calendars.Read.Shared**. | Personal delegated accounts and application permissions are unsupported. Confidence is not proof that each person is free: check individual status and organizer status. The connector's own wire schema is not the Graph request schema. |
| [Outlook Send an HTTP request](https://learn.microsoft.com/en-us/connectors/office365/#send-an-http-request) | `HttpRequest` documents first segments `/me`, `/users/<userId>` and second segments including `calendar`. Thus `/me/calendar/getSchedule` fits the documented segment rule. | This is evidence of a candidate, not a guarantee for every descendant route, mailbox policy, grant, tenant or account. It is the existing Outlook connector, **not a new HTTP with Microsoft Entra ID connection**. No connector change or permission expansion is proposed for feasibility. |

The [Free/Busy concept article](https://learn.microsoft.com/en-us/graph/outlook-get-free-busy-schedule) still says `Calendars.Read` is minimum; the current v1.0 operation reference lists `Calendars.ReadBasic`. Use the operation reference when evaluating a future least-privilege Graph grant, and record this documentation discrepancy rather than increasing permissions. Neither statement establishes the actual scope of the preserved Outlook connection.

`getSchedule` concerns the user's **default calendar**, as documented by [scheduleItem](https://learn.microsoft.com/en-us/graph/api/resources/scheduleitem?view=graph-rest-1.0). Its address-based input does not select all custom calendars returned by the own-calendar picker. Never claim the owner's other calendars or a complete family schedule were checked.

Provider bounds: up to 20 entities, time span less than 62 days; grid interval 5–1440 minutes, default 30. A crowded time slot can produce error `5006`; individual lookup errors can coexist with HTTP 200. These are maximum API bounds, not appropriate prototype defaults. Recommend **two explicitly selected adults, one user-chosen day, 30-minute intervals** for the next narrowly scoped test, without choosing any actual date or inferring a timezone. Handle daylight-saving boundaries explicitly; do not assume a local day always equals 24 hours.

## Actual read-only Azure evidence

The approved subscription is `609bbde3-d152-4d7d-a12b-005e38ac4f27`, tenant `72f988bf-86f1-41af-91ab-2d7cd011db47`, resource group `vdi-prebuilt-dte`, region `eastus`.

The successful inspection reused the existing status-only backend under [local owner-operation exclusion](../scripts/owner-operation.js). Existing account/caller/connection/invitation guards and the exact owner v2 definition were checked before and after the Swagger read. Only management metadata was read; tokens remained in process memory and were cleared. Resource payloads were not printed. The operation excerpts were public schemas, not calendar data.

Source: exact managed API `office365?api-version=2016-06-01&export=true` under the approved subscription's `Microsoft.Web/locations/eastus/managedApis`.

| Observed metadata | Result |
| --- | --- |
| `HttpRequest` exported path / method | `/{connectionId}/codeless/httprequest`, `post`, `deprecated: false` |
| Upstream URI / method parameters | Required string **headers** `Uri` and `Method`; method enum includes `POST` (also other methods, which any future application must reject) |
| Payload / content-type parameters | Optional `Body` in body, schema string/binary; `ContentType` header defaults to `application/json` |
| URI documentation in Swagger | `/me` plus second segment `calendar` explicitly present |
| HTTP response schema | `ObjectWithoutType`; this is **not** a validated `getSchedule` response contract |
| `FindMeetingTimes_V2` exported path / method | `/{connectionId}/codeless/beta/me/findMeetingTimes`, `post`, `deprecated: false` |
| Meeting inputs / output | `RequiredAttendees`, `Start`, `End`, `MeetingDuration`, `MaxCandidates`, etc.; `meetingTimeSuggestions`, not a Free/Busy grid |
| `familycopilot-calendar-list-dev` | Exact `local-owner-list-v2`, Disabled, SAS Disabled |
| `familycopilot-office365-dev` | Connected, reference only |
| `familycopilot-invitations-dev` | Disabled, SAS Disabled, delivery off |
| Resource comparison | Connection, invitation and owner workflow identical across the inspection reads; not a distributed lock or guarantee against later external changes |
| Calendar request / cloud mutation | Neither occurred |

The `/codeless/beta/...` path is what the connector exports; do not replace it with a guessed `/v1.0/...` connector path or describe the wire path as v1.0. Conversely, the candidate HTTP action path is `/codeless/httprequest` (ApiConnection supplies `/{connectionId}`), with a future fixed `Uri` of `https://graph.microsoft.com/v1.0/me/calendar/getSchedule` and `Method: POST`. No such action was deployed or invoked. Binary body encoding and runtime routing still need a synthetic adapter contract before an authorized live test.

## Busy-only is a disclosure policy, not a no-data-fetch claim

The [provider documentation](https://learn.microsoft.com/en-us/graph/outlook-get-free-busy-schedule#event-data-returned) explicitly allows `getSchedule` to return **subject, location and isPrivate**, depending on event sensitivity and the requested user's sharing settings. The owner response may expose more than the other person's response. An Outlook display of Free/Busy does not guarantee a title-free connector payload.

Before any future real request:

1. Confirm exact actors, account/source, range/timezone, authorized purpose, busy-only disclosure and audience in an access summary. Calendar listing selection alone grants no event-derived access. No family membership or OAuth-only shortcut.
2. Fix and validate the upstream host, route, method and bounded body; no arbitrary URL, calendar-view fallback, extra mailbox, distribution list expansion, `$batch` or automatic retry. Do not increase permissions on failure.
3. Apply allowlist projection **inside the cloud workflow before its response reaches the local backend, UI or assistant**. Bind each `scheduleId` to a confirmed request-local actor key, then discard addresses, subject, location, private flags, working hours, arbitrary fields and raw errors. Only authorized time/status context and fixed per-actor result codes may leave that boundary. Provider data remains untrusted.
4. Protect Request inputs/outputs as supported, connector inputs/outputs, validation, projection and every downstream response/failure path. [Microsoft secure-history guidance](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-securing-a-logic-app#secure-data-in-run-history-by-using-obfuscation) requires explicit downstream protection: Parse JSON, Compose and Response use Secure Inputs with implicit output hiding; protection does not automatically propagate beyond them. No tracked properties, raw diagnostics, workflow outputs or payload-link inspection. Retain exact caller/SAS/content-access guards.
5. Disclose that Azure processes the raw response and retains service-managed protected history. Redaction does **not** mean event information was never fetched, physical erasure, zero storage or a reviewed production retention policy. If the requirement is that even the cloud must never receive titles/locations, this route cannot currently promise it.
6. Validate missing/duplicate/unexpected identities, malformed or wrong-length grids, partial errors, revocation, stale context, oversized data and cancellation. Clear and fence late responses on deselection, pause, disconnect or cancellation. Do not turn any of these into free time.

`availabilityView` values are `0` = free **or working elsewhere**, `1` = tentative, `2` = busy, `3` = out of office. A grid-only projection must not label `0` as confirmed availability for an outing. The UI should say **No busy block reported (may be working elsewhere)** for that checked source and interval. Unknown values remain unknown; tentative/out-of-office can be conservatively combined into busy-only without exposing a reason. A full grid means coverage of the requested default-calendar time window, not complete personal availability.

## Two-person UI acceptance for the next increment

Not implemented by this feasibility-only change:

- Two distinct named rows: the owner's chosen label and the explicitly confirmed other adult (the owner currently intends Parent B). Three calendars belonging to the owner do not meet this requirement. Tests and agent browser review must use synthetic Alex/Sam identities, never real schedules.
- Each row independently records selected source, disclosure, exact checked range/timezone and successful retrieval timestamp. Idle/unselected rows say **Not checked**; an absent response says **Missing**; a provider failure says **Unavailable** or a verified **Access revoked** status, not empty/free. Keep loading, partial and stale states distinct and textual.
- A successful owner lookup cannot mark the second person checked. Failed/missing rows remain visible. Global comparisons explicitly identify missing context; no shared-free claim if either participant is unresolved. Unchecked custom calendars remain disclosed as additional missing context.
- Do not show invented event titles, meeting details or a fake connected status to satisfy the two-person goal. Activity discovery stays independent. No invitation, booking, event write, unattended polling or assistant ingestion is implicitly added.

Next material inputs: the owner must supply the **exact intended SMTP address**, **date and start/end time with timezone**, and confirm an **authorized purpose and audience** for any proposed live comparison. Also confirm which owner address/default calendar is intended without deriving it from browser data. Those details are not passwords or tokens. Providing them does not itself deploy a workflow or authorize an unreviewed live call; the current approval covers verification only. Architecture approval need not be repeatedly requested for the completed metadata inspection.

## Reusable verification and validation record

- [scripts/availability-capability.js](../scripts/availability-capability.js) accepts only `--metadata-only` or local `--help`. It has no live, deployment, mailbox, date, URL, persistence or invocation option. It reuses the status-only backend, exact five-path GET allowlist and cooperative loopback exclusion acquired before credentials; nine metadata GETs on a successful check. Reports contain only fixed boolean evidence; unknown metadata is never echoed and cannot establish runtime authorization.
- [test/availability-capability.test.js](../test/availability-capability.test.js) has eight offline tests covering schema/method/segment drift, suggestion-vs-grid evidence, fixed paths, no identity leakage, disabled/caller/history guards, resource drift, errors/credential clearing, invalid CLI arguments and lock ordering. No new dependency or framework.
- Baseline **156 passed, 0 failed**. Focused **8 passed, 0 failed**; full **164 passed, 0 failed**. `git diff --check` and changed-code editor diagnostics passed.
- The initial read-only inspection above succeeded. The subsequent reusable script execution stopped at the existing backend's credential freshness check. Safe diagnostic output was `phase: credentials`, `code: expired`, before any ARM request. This code can mean less than the backend's required remaining token lifetime, not necessarily an already invalid token. No interactive sign-in, credential-policy weakening or live calendar retry was attempted. **The new script is offline-tested, but its successful end-to-end cloud execution is not claimed.** A later run requires an adequately fresh existing CLI session; no password/token should be sent to an agent.
- No UI code changed and no browser review occurred in this increment. Parent usability approval, target mailbox authorization, two-person runtime results and production readiness remain unverified. All pre-existing uncommitted work was preserved; nothing was committed or pushed.