# Parent-facing schedule and activity discovery plan

## Planning status and first-version contract

This document is a proposal for review, not authorization to implement. Product behavior, privacy examples, the child's actual Google account type, supported calendar access, and the web-demo storyboard must be reviewed with the parent before implementation issues are opened.

The first version is for parents. It responds only when asked and may:

- answer schedule questions from currently permitted calendar data;
- compare availability and identify possible conflicts without claiming missing time is free;
- research science activities, concerts, exhibitions, and similar outings;
- assess whether a pasted event page appears to fit the available schedule; and
- explain sources, freshness, assumptions, missing context, and uncertainty.

It must not send unsolicited recommendations or notifications; serve as a child-facing assistant; create, edit, delete, accept, or decline events; book activities; register children; buy tickets; or start monitoring an event. Calendar events and external pages are untrusted evidence, never instructions or authorization to act.

### Representative parent scenarios

1. **Understand the schedule:** “What does our family have this weekend?”
2. **Discover an activity:** “Find a weekend science activity for my 8-year-old within a 30-minute drive.”
3. **Fit an outing:** “Suggest a kid-friendly concert or exhibition that fits our Saturday schedule.”
4. **Assess a known event:** Paste an event URL and ask, “Does this exhibition fit our schedule?”

Age, location, interests, budget, and travel time in these prompts are examples, not stored facts about a child or family.

## UX outcome

Family Copilot should let a parent understand family commitments and evaluate outings without making them learn provider internals. A parent can try activity discovery without connecting a calendar; calendar connection is offered when schedule-fit analysis needs it.

The experience is read-only and follows these principles:

- **Explain value before asking for access.** State what schedule questions become possible and that Family Copilot cannot change events.
- **Make consent specific.** Show which account, calendars, fields, family members, and retention rules apply before import.
- **Let the guardian minimize access.** Calendars are off until selected, and each can expose event details or only busy times.
- **Show provenance and freshness.** Answers distinguish Outlook from Google events and disclose stale or disconnected sources.
- **Keep control reversible.** A guardian can pause sync, change visibility, disconnect, export, or delete imported data from one place.

### Primary users

- **Parent/guardian:** asks questions, connects provider accounts, confirms authority to use a child's calendar, chooses calendars and privacy levels, and manages or removes access.
- **Other parent:** may connect their own account and receives only information allowed by the calendar owner's disclosure policy. Direct child use is outside the first version, and a child is never asked to provide credentials.

The connected account, the person whose schedule a calendar represents, the fields Family Copilot may process, and the people who may receive those fields are separate decisions. In the first version, a personal or work calendar is always busy-only when disclosed to another parent or family member. Its details may answer the calendar owner's own question but are never disclosed cross-parent.

### Core journey

1. **Discover:** Calendar settings explain the read-only benefit, supported providers, data use, and the difference between event details and busy-only access.
2. **Connect Outlook:** The guardian selects **Connect Outlook**, reviews the single read-only calendar permission, completes Microsoft consent, and returns to Family Copilot. The subsequent Family Copilot picker—not the OAuth grant—controls which owned or shared custom calendars are included.
3. **Connect the child's calendar:** Family Copilot explains how to share the Google calendar read-only with a guardian-controlled account. The guardian attests that they are authorized, selects **Connect Google**, and completes Google consent.
4. **Choose access:** Family Copilot lists calendars without importing events. The guardian selects calendars, labels whose schedule each represents, and chooses **Details** or **Busy only** for each.
5. **Review and confirm:** A summary shows accounts, calendars, visibility choices, imported date range, retention, and affected family members. Import starts only after confirmation.
6. **Verify:** Sync progress ends with a preview of representative upcoming events exactly as the agent will see them. The guardian can correct calendar ownership or privacy settings.
7. **Use:** Agent answers include source labels and a “last updated” time. Private or busy-only events appear as unavailable time without revealing content.
8. **Manage:** Calendar settings show connection health, selected calendars, visibility, last sync, and actions to retry, pause, reconnect, disconnect, export, or delete.

### Required screens and states

| Surface | Required content and behavior |
| --- | --- |
| Calendar overview | Provider connection cards, read-only badge, last successful sync, selected calendar count, and manage action |
| Pre-consent explanation | Benefits, exact data uses, fields requested, retention summary, provider scopes, and cancel action |
| Calendar picker | Account identity, calendar owner/label, selection toggle, Details/Busy-only choice, sharing instructions when an expected family calendar is missing, and child-calendar attestation |
| Pre-import confirmation | Access summary, date window, family visibility, confirm and back actions; no event data is retrieved yet |
| Post-sync preview | Representative upcoming events exactly as the agent may disclose them, with source and privacy redaction visible |
| Schedule result | Structured commitments and conflicts, human-readable sources, freshness, privacy-safe event display, and no claim of completeness when a source is stale |
| Activity result | Suitability rationale, date/time, age guidance, cost, estimated travel, source links, calendar fit, and explicit unknown/unverified labels |
| Event-URL assessment | Identified event/performance, page source, extracted facts, schedule comparison, uncertainty, and no booking or monitoring action |
| Connection management | Pause/retry/reconnect, change selection or privacy, disconnect and revoke where supported, export, and delete |

Every asynchronous surface needs explicit loading, empty, partial, stale, permission-revoked, provider-unavailable, and unsupported-child-account states. Errors must explain whether existing results remain usable and offer a safe recovery action without exposing provider internals.

### UX acceptance criteria

- A guardian can understand the benefit and read-only boundary before leaving Family Copilot for provider consent.
- No events are imported until the guardian selects calendars, chooses their visibility, records whose schedules they represent, and confirms.
- The child-calendar flow establishes guardian authority and never requests the child's password.
- A missing spouse or child Outlook calendar explains that Microsoft family membership alone does not grant calendar access and offers sharing or separate-account connection instructions.
- The post-connection preview matches what the agent may disclose, including private and busy-only redaction.
- Every schedule answer identifies its sources and freshness; stale or partial data is never presented as complete.
- “No conflict found” is shown only for the calendars and time range actually checked; incomplete context is labeled “cannot verify availability,” never “free.”
- A guardian can pause, reconfigure, disconnect, export, and delete calendar data without contacting support.
- Keyboard-only and screen-reader users can complete all steps, and status is not communicated by color alone.

UX prototypes and usability testing with parents must validate this journey and terminology before provider adapters are implemented.

## Activity discovery and event assessment

Activity discovery is sourced research, not a recommendation engine acting autonomously. Ask only for preferences needed for the current request: age range, interests, general starting area, dates, budget, accessibility needs, and travel preference. Do not require a child's name, exact birth date, school, home address, or persistent profile.

For every option:

- retain and show the source URL and the exact event/performance identity;
- show date/time, venue or area, published age guidance, stated cost, and why it may suit the request;
- estimate travel only from a parent-provided general starting area and a cited routing/map result when available;
- identify whether ticket availability was actually verified, merely listed, stale, or unknown;
- compare against only fresh, authorized calendar context and name calendars that are missing or stale; and
- label inferred, conflicting, or unverified details rather than silently resolving them.

A “within 30 minutes” request is a preference, not a guarantee. Without reliable travel evidence, return the known distance/location and mark travel time unverified. Without a connected calendar, discovery still works, but the result says schedule compatibility was not checked. A failed search returns what was searched, which filters may be relaxed, and no fabricated alternatives.

External page content is sanitized and treated as data. It cannot override system policy, request calendar disclosure, initiate tools, or authorize a booking. A pasted URL supports assessment of the identified event only.

## Mobile-friendly hosted web demo

The agreed demo entry point is a dedicated hosted web app optimized for mobile browsers. Browser extensions, native apps, messaging integrations, API-only delivery, PWA installation, proactive notifications, and TicketForge monitoring are outside the demo.

The main page contains a question box, representative prompts, a separate event-URL input, and structured results rather than chat-only prose. Calendar discovery is optional and uses dedicated consent/settings surfaces.

### End-to-end storyboard

1. **Understand a family schedule:** Select a schedule example, optionally connect calendars, review source/freshness labels, and receive commitments plus conflicts. Loading, empty, partial, stale, permission-denied, and disconnected states never turn missing data into free time.
2. **Discover suitable activities:** Enter minimal age/interests/location/date/budget preferences, review sourced activity cards, and inspect suitability, timing, cost, estimated travel, verification state, and calendar fit. This journey works without calendar access.
3. **Assess an event URL:** Paste a page, verify the extracted event/performance, and compare it with available schedule context. Unsupported pages, ambiguous performances, extraction failures, stale listings, and missing calendars produce recoverable explanations.

### Truthful demo labeling

- **Sample calendar:** clearly labeled synthetic data; never represented as the family's schedule.
- **Connected calendar:** shows provider, represented person, disclosure mode, and last successful sync.
- **Mock activity result:** labeled example data and never described as live research or current availability.
- **Live source:** links to the source and distinguishes published facts from Family Copilot estimates or inferences.
- **Unknown:** displayed explicitly; absence of evidence is not converted to availability, suitability, or a free schedule.

The usability test succeeds when a parent, without facilitator explanation, can find a plausible activity, understand why it may fit, open its supporting sources, identify what calendar context was checked, and distinguish sample data, verified facts, estimates, and assumptions. The parent must also understand that Family Copilot cannot book, purchase, alter calendars, or monitor tickets.

## Child Google Calendar feasibility gate

The child likely uses a Family Link-supervised Google account, but this must be confirmed. Family Link supervision does not itself give a parent access to Calendar content, and the parent currently cannot see the child's calendar or titles. Therefore, the Google connection design below is provisional.

Before selecting a production path, test with the actual account configuration:

1. record whether it is a supervised consumer account, Workspace for Education account, or another managed account;
2. determine whether Calendar sharing is available and whether a parent-controlled Google account can receive and read event details;
3. determine whether third-party OAuth is allowed and which account can legally and technically provide consent;
4. verify what private-event and title fields the Calendar API returns; and
5. document provider errors, age/supervision restrictions, and revocation behavior.

Do not ask for the child's password or bypass supervision. If no supported parent-authorized path exists, the safe first-version fallback uses the parent's Outlook calendar and clearly labeled sample or otherwise available calendars. Every answer identifies the child's schedule as missing and says availability cannot be fully verified.

## Future TicketForge boundary

TicketForge is a possible later handoff after a parent selects one exact event/performance. Family Copilot would pass the source page and selected performance only after explicit confirmation; TicketForge would own monitor investigation, generation, validation, deterministic checks, reduced-capability/refusal states, staleness, failures, and repair.

Family Copilot must not duplicate that monitoring system. A TicketForge failure is not “sold out,” monitoring does not authorize purchasing or calendar changes, and background checks or alerts require a separate opt-in design. TicketForge integration is not part of this demo or first version.

## Provisional technical decisions derived from the UX

The intended sources are a parent's Outlook calendar and, only if the feasibility gate identifies a supported path, a child's Google calendar. A parent or verified guardian selects calendars to include and can disconnect or erase either source. These proposals remain provisional until product, privacy, feasibility, and UX decisions are reviewed. Write access is explicitly deferred.

The integration consists of provider adapters behind one synchronization service:

1. OAuth callbacks exchange authorization codes on the server.
2. Encrypted connection records retain refresh credentials and sync cursors.
3. Provider adapters perform an initial bounded import and subsequent incremental refreshes.
4. Events are normalized into a provider-neutral store.
5. The agent receives only the minimum event fields needed for the current request, with event text treated as untrusted content.

## Provider APIs and authentication

### Microsoft Outlook

Use [Microsoft Graph Calendar](https://learn.microsoft.com/graph/api/resources/calendar) with an app registration in Microsoft Entra ID that supports the intended account type, including personal Microsoft accounts when required.

- Use the OAuth 2.0 [authorization code flow with PKCE](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow). Generate and verify `state` and OIDC `nonce`, use an exact allowlisted HTTPS redirect URI, and perform the code exchange on the server.
- Request delegated `Calendars.Read` for the signed-in user's calendars, `offline_access` for a refresh token, and OIDC `openid` for a stable connected-account subject. Request `profile` only if the UX needs additional account display fields. A shared custom calendar added to the recipient's mailbox can be read through `/me/calendars` with `Calendars.Read`.
- Use `/me/calendars` for calendar selection and `/me/calendars/{calendar-id}/calendarView` to load occurrences from each selected calendar in a bounded time window. Microsoft Graph v1.0 [calendar view delta](https://learn.microsoft.com/graph/delta-query-events) supports the primary calendar, so use it there and store returned `@odata.nextLink` and `@odata.deltaLink` values as opaque secrets. Reconcile complete bounded snapshots for other selected calendars rather than relying on a beta per-calendar delta endpoint.
- Do not request application permissions or `Calendars.ReadWrite` in the first release. A future write feature must use a separate incremental-consent step for delegated `Calendars.ReadWrite`.

Microsoft family membership is not calendar consent. Access to a spouse's or child's Outlook calendar must follow one of these explicit paths:

1. **Share a custom calendar with the guardian account:** The calendar owner, or an authorized adult managing the account, creates or chooses a custom calendar, shares it read-only in Outlook, and places the family events to expose there. The guardian accepts or adds it in Outlook before returning to Family Copilot. It then appears in `/me/calendars`; Family Copilot cannot create the share or elevate its sharing level.
2. **Connect separately:** The spouse signs in to their own Microsoft account, consents to `Calendars.Read`, and selects their calendar. Each connection retains its own token and can be removed independently.

Direct access to another user's shared primary calendar is deferred because it requires `Calendars.Read.Shared`, the owner's mailbox identifier, and different owner-mailbox endpoints whose IDs cannot be mixed with `/me/calendars` IDs. Prefer the custom-calendar path for a child's schedule only when a guardian is authorized to configure that account. Never ask the guardian for the spouse's or child's password, impersonate them, or use application-wide access. Work/school tenant policy, disabled user consent, cross-tenant sharing rules, personal-account age restrictions, or a supervised child account may block consent or sharing; the UX must identify the blocked step and direct the family to the Microsoft or organization administrator rather than attempting a workaround. A spouse's consent remains independent and revocable even when both adults belong to the same Family Copilot family.

### Expected Microsoft family onboarding friction

- The spouse or calendar owner must take an action in Outlook; adding people to a Microsoft Family group alone is insufficient.
- The Microsoft Family group calendar itself is limited to Microsoft Outlook experiences and is not a supported Graph source for this integration. The family must use a separately shared custom calendar instead.
- The owner controls whether the recipient sees only free/busy, limited details, or full non-private details. An ordinary read-only share never exposes private-event details; Family Copilot always represents those as busy-only.
- A sharing invitation may need to be accepted or the calendar explicitly added before Graph returns it. The calendar picker must offer **I've shared it—check again** and troubleshooting guidance.
- A spouse who does not want to share with the guardian can use a separate connection and revoke it independently.
- A child's age, account supervision, or organization/school policy may prevent OAuth consent or external calendar sharing. That is a blocking provider-policy outcome, not an application error.
- Delegated access to shared calendars does not support Graph change notifications. Shared sources therefore use bounded reconciliation and may refresh less immediately than the guardian's primary calendar.

The first-release UX should recommend read-only sharing with the guardian because it avoids handling credentials for every family member, while keeping separate account connections available for independent adult consent.

### Google Calendar

Use [Google Calendar API v3](https://developers.google.com/workspace/calendar/api/v3/reference) in a Google Cloud project with an OAuth consent screen.

- Use the OAuth 2.0 [web-server authorization flow](https://developers.google.com/identity/protocols/oauth2/web-server) with PKCE, `state`, OIDC `nonce`, an exact allowlisted HTTPS redirect URI, and offline access. The server exchanges the code, validates the ID token, and stores any refresh token.
- Request OIDC `openid` for a stable connected-account subject and `email` so the confirmation UI can identify the account. Request `https://www.googleapis.com/auth/calendar.calendarlist.readonly` so the parent can select an accessible calendar and `https://www.googleapis.com/auth/calendar.events.readonly` to read its events. Do not request the broader `calendar` scope.
- Use `calendarList.list` for selection and [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) for loading. Expand recurring events with `singleEvents=true` and retain the series identifier.
- Refresh Google calendars with bounded `events.list` queries using the same import window, `singleEvents=true`, and `showDeleted=true`, then reconcile the complete paged result. Do not combine `syncToken` with `timeMin` or `timeMax`; Google prohibits that combination. An unbounded sync-token strategy may be considered later only after a separate data-retention and privacy review.
- Do not request write scopes in the first release. A future write feature must use a separate incremental-consent step for `https://www.googleapis.com/auth/calendar.events`.

For a child's calendar, sharing read-only with a guardian-controlled Google account is only a candidate path to validate through the feasibility gate; it is not assumed to work for a Family Link-supervised or managed account. If supported, the guardian authorizes Family Copilot and explicitly selects that calendar. The application must not ask a child to share a password or capture a child's credentials. Workspace or supervised-account restrictions may prevent sharing or third-party OAuth; the UI must report that limitation rather than bypass it.

## Secure connection and token handling

Store one connection per provider account and family. The connection record contains the provider, provider account subject, granted scopes, token expiry, consent timestamps, and encrypted refresh credential.

Store a separate selection record for every connected calendar. It contains an internal connection reference, encrypted provider calendar ID, guardian-assigned family member, disclosure mode (`details` or `busy_only`), allowed family audience, consent-policy version and timestamp, lifecycle state (`active`, `paused`, or `disconnected`), synchronization generation, and an optional per-calendar sync cursor. Authorization checks and redaction use this record rather than provider visibility alone.

Privacy reductions are fail-closed and atomic from the user's perspective. Changing from Details to Busy-only, narrowing the audience, or deselecting a calendar immediately blocks the old disclosure policy, advances its synchronization generation, and queues deletion of no-longer-permitted fields from normalized records, caches, embeddings, and summaries. The UI shows the change as pending until cleanup succeeds and retries failures without restoring broader access.

- Keep client secrets and encryption keys in a managed secret store; never ship them to a browser or mobile client.
- Encrypt refresh tokens with envelope encryption and a managed KMS key. Restrict decryption to the synchronization service, rotate keys, and keep production credentials out of source control.
- Store access tokens in memory or an encrypted short-lived cache only. Rotate refresh tokens when a provider returns a replacement. On disconnect, revoke Google tokens through Google's revocation endpoint; for Microsoft, which has no per-application token-revocation endpoint, immediately delete local credentials and offer instructions for removing the application's consent in the Microsoft account.
- Never log authorization codes, tokens, opaque sync links, raw event bodies, attendee addresses, or calendar IDs. Use generated internal IDs and structured redaction.
- Enforce tenant/family ownership on every connection and event query. Separate OAuth callback state from user-supplied return URLs to prevent account-linking and redirect attacks.
- Record connect, scope change, calendar selection, sync, export, disconnect, and deletion actions in a metadata-only audit trail.

## Loading and refresh

### Initial import

1. After consent, list accessible calendars and require the guardian to select each source explicitly.
2. Show the access summary and persist the guardian's confirmation, calendar ownership labels, and visibility choices before retrieving any events.
3. Import a configurable bounded window (initially 30 days in the past through 365 days in the future), paging until complete.
4. Upsert normalized events by `(connection_id, provider_calendar_id, provider_event_id, occurrence_key)` and apply provider cancellation/deletion markers.
5. For the primary Microsoft calendar, save a sync cursor only after all pages commit successfully. If a page fails, retry idempotently without advancing the cursor.

### Incremental refresh

Calendar refresh is data maintenance authorized by the parent's active connection, not proactive agent behavior. It must never produce a recommendation, message, notification, monitoring task, or external action. The consent screen discloses refresh frequency; pause or disconnect stops new jobs.

- Poll each actively connected calendar initially every 15 minutes with jitter and exponential backoff solely to maintain freshness for later parent questions. Respect provider throttling and `Retry-After`.
- Each job captures the selection's synchronization generation when it starts and may commit only while the selection is still active with the same generation. Privacy changes, pause, deselection, deletion, and disconnect advance the generation transactionally, fencing in-flight jobs before cleanup.
- Use Microsoft calendar-view delta links for the primary calendar. Treat its cursor as bound to the time window and request parameters; when rejected, clear it and repeat the bounded import. Reconcile complete bounded snapshots for non-primary Microsoft calendars.
- For Google, re-fetch and reconcile the complete bounded window because its sync tokens cannot be combined with the required time bounds. Page consistently, replace the previous snapshot only after a successful complete fetch, and rate-limit polling.
- Run a daily reconciliation import to recover from missed changes. Stop promptly when access is revoked or a calendar is deselected.
- Add provider webhooks later as a latency optimization, not as the source of truth. Validate webhook authenticity, use opaque subscription IDs, renew subscriptions, and still reconcile through each provider's authoritative refresh mechanism.

A delete action must atomically pause and deselect the affected calendar, advance its synchronization generation, and then purge its data so scheduled or in-flight refreshes cannot re-import it. Resuming that source requires the guardian to select it again and complete a fresh access summary and confirmation.

Store provider timestamps in UTC while preserving the provider time-zone identifier and the original all-day date boundaries. Recurrence exceptions, cancellations, and moved occurrences must remain distinguishable. The agent must not infer that imported events are current if a connection is in an error or stale state.

## Common event model

```text
CalendarEvent
  id: UUID
  family_id: UUID
  connection_id: UUID
  calendar_selection_id: UUID
  source: "microsoft" | "google"
  provider_calendar_id: encrypted string
  provider_event_id: encrypted string
  provider_series_id: encrypted string?
  occurrence_key: string?
  calendar_label: string?
  title: string?
  description: string?
  location: string?
  start_at: timestamp?
  end_at: timestamp?
  start_date: date?
  end_date_exclusive: date?
  time_zone: IANA or provider time-zone identifier?
  is_all_day: boolean
  status: "confirmed" | "tentative" | "cancelled" | "unknown"
  visibility: "default" | "public" | "private" | "confidential"
  organizer: Participant?
  attendees: Participant[]
  recurrence: string[]
  last_modified_at: timestamp
  source_etag: string?
  imported_at: timestamp
  deleted_at: timestamp?

Participant
  display_name: string?
  address: string?
  response: "accepted" | "declined" | "tentative" | "needs_action" | "unknown"
```

`start_at`/`end_at` are used for timed events and `start_date`/`end_date_exclusive` for all-day events. The normalized record preserves provider IDs for synchronization but does not expose them to the agent. Optional sensitive fields such as description, location, organizer, and attendees should be omitted from storage unless a feature requires them; free/busy-only views should contain no title or participants.

Provider payloads remain authoritative. Normalization must preserve unknown values safely, avoid inventing attendees, and map unsupported provider statuses to `unknown` rather than dropping the event.

## Privacy, consent, and safety

- Require a verified adult guardian to connect or select a child's calendar and attest that they are authorized to process it. Obtain any additional consent required by the child's age, account type, school policy, and jurisdiction before collection.
- Show the provider account, selected calendars, exact scopes, imported fields, retention period, and agent uses before connection. Keep consent records versioned and allow calendar-level opt-out.
- Default to data minimization: import only the configured window and selected calendars, hide private-event details unless explicitly allowed, and send only request-relevant fields to the model.
- Do not use calendar data for advertising, model training, or unrelated profiling. Do not expose one family member's private details to another without an explicit family-sharing policy.
- Treat titles, descriptions, locations, links, and attendee text as untrusted data, never as agent instructions. Escape rendered content and prevent events from triggering tools or write actions without an independent authorization check.
- Provide export, disconnect, and deletion controls. Privacy downgrades and deselection purge newly disallowed content. Disconnect revokes access where the provider supports per-app revocation, deletes local credentials, and queues tokens, cursors, normalized events, caches, and derived embeddings/summaries for deletion under a documented retention SLA. Retain only legally required audit metadata.
- Encrypt data in transit and at rest, apply least-privilege service roles, audit privileged access, define incident response, and periodically review provider grants.
- Complete legal review against the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), Microsoft platform terms, and applicable child-privacy law before production use.

### Proposed retention and export

These values require parent and legal review before implementation:

- Keep normalized events only inside the selected import window (initially 30 days past through 365 days future). Purge events that leave the window after the next successful reconciliation.
- A privacy reduction blocks access immediately and removes newly prohibited details from active stores, caches, embeddings, and summaries within 24 hours.
- Calendar deletion or disconnect makes data inaccessible immediately and removes credentials, cursors, normalized events, caches, embeddings, and summaries from active systems within 24 hours. Encrypted backup copies expire within 30 days and are not restored into active use.
- Keep metadata-only security and consent audit records for one year unless legal review selects a shorter period. They contain actor/internal IDs, action, policy version, provider, outcome, and timestamp—not tokens, event content, attendee data, calendar IDs, URLs, queries, or child preferences.
- Provide a downloadable UTF-8 JSON export containing connection/provider labels, represented-person labels, calendar disclosure settings, consent history, and normalized event records currently retained and visible to the requesting parent. Exclude secrets, tokens, sync cursors, encryption metadata, internal security logs, data outside the requester's audience, and purged content.
- Activity requests and results are session-only by default. Persist a saved activity only after an explicit parent action, retaining its source URL, exact event/performance identity, cited facts, and parent-entered notes until the parent deletes it.

Validate disclosure rules with concrete scenarios before building a generalized permissions system:

| Scenario | Allowed response |
| --- | --- |
| Parent asks about their own work calendar | Use authorized details for that parent's answer; never disclose those details to another parent in the first version |
| Other parent asks when the calendar owner is available | Return busy intervals only; personal/work event details are never disclosed cross-parent in the first version |
| Parent asks about an authorized child/activity calendar | Use only fields permitted by the provider share and recorded guardian policy |
| Event is private, outside the requester's audience, or busy-only | Report unavailable time without title, location, attendees, description, or inferred purpose |
| Child calendar is missing, stale, or unsupported | Name the missing context and say availability cannot be fully verified |

## Planning review and eventual rollout criteria

Before implementation, the parent reviews and agrees the scenarios, on-demand behavior, non-goals, privacy examples, calendar feasibility result, demo storyboard, activity result contract, and sample/mock labeling. Unresolved choices remain visibly marked; this plan is not approval to start coding.

PR #2 reconciles the written proposal with the updated issue but does not complete the issue's validation acceptance criteria. Issue #1 must remain open until the parent review, actual Family Link/account feasibility test, and hosted-web storyboard usability review are completed and their outcomes are recorded here. Remove any automatic closing reference from the PR before merge if those gates are still open.

An eventual first version can maintain a read-only schedule view, answer schedule questions, identify possible conflicts, research activities, and assess event pages. It cannot create, edit, delete, accept, or decline events; notify proactively; monitor tickets; book; register; or purchase. UI copy and agent tools must make those boundaries explicit.

Before an eventual rollout:

- OAuth threat-model tests cover CSRF, PKCE, callback replay, redirect validation, account linking, token leakage, and revocation.
- Adapter contract tests cover owned and shared calendars, sharing-level redaction, pagination, recurrence, all-day events, time zones, cancellations, throttling, expired cursors, and idempotent retry.
- Privacy tests confirm family isolation, private-field filtering, child-calendar deletion, audit redaction, and prompt-injection containment.
- Activity tests cover source attribution, exact performance identity, uncertainty, failed extraction/searches, missing calendar context, travel estimates, and untrusted-page containment.
- Operational metrics cover sync age and failures without event content or provider identifiers.

Write actions are a later opt-in phase requiring narrow write scopes, explicit confirmation for every user-visible change, idempotency, conflict handling, a durable audit trail, and a rollback/correction experience.

## Follow-up issue plan

Do not create implementation issues until the parent has reviewed and agreed the product, privacy, feasibility, and UX decisions above. First create and complete planning/validation issues:

1. **Review parent scenarios and behavior boundaries:** Confirm usefulness, on-demand behavior, non-goals, privacy examples, and required activity fields.
2. **Investigate the actual child Google account:** Record account type and test parent-authorized Calendar sharing/OAuth with the real configuration; produce a supported path or documented unresolved limitation.
3. **Prototype and usability-test the hosted web demo:** Cover all three journeys, consent and disclosure preview, structured results, sample/mock/live labels, accessibility, missing/stale calendars, empty searches, unsupported pages/accounts, and removal of access/data.

After those decisions are approved, split implementation into independently scoped issues:

1. **Define the calendar domain model and provider adapter contract.**
2. **Implement secure OAuth connection storage and privacy controls.**
3. **Implement the approved Microsoft read-only calendar path.**
4. **Implement Google Calendar only if feasibility identifies a supported child-calendar path.**
5. **Build synchronization, freshness, observability, and cleanup.**
6. **Build read-only schedule answers and conflict analysis.**
7. **Build sourced activity discovery and event-URL assessment.**
8. **Build the reviewed mobile-friendly hosted web demo.**

Calendar and activity-discovery work remain separate so either can ship or be tested without the other. TicketForge monitoring, proactive behavior, calendar writes, booking, purchasing, native apps, extensions, and messaging integrations require later issues and explicit scope approval.

## References

- [Microsoft Graph calendar overview](https://learn.microsoft.com/graph/outlook-calendar-concept-overview)
- [Get shared or delegated Outlook calendars and events](https://learn.microsoft.com/graph/outlook-get-shared-events-calendars)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)
- [Microsoft Graph calendar view delta](https://learn.microsoft.com/graph/delta-query-events)
- [Google Calendar API authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API synchronize resources](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Google Calendar sharing](https://support.google.com/calendar/answer/37082)
- [Google Family Link account management](https://support.google.com/families/answer/7103262)
