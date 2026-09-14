# Outlook and Google Calendar integration plan

## UX outcome

Family Copilot should give a guardian one understandable view of family commitments without making them learn how calendar providers work. The first release answers questions such as “What does our family have tomorrow?”, “When are we both free?”, and “Will pickup overlap my meeting?” using a parent's Outlook calendar and a child's Google calendar.

The experience is read-only and follows these principles:

- **Explain value before asking for access.** State what schedule questions become possible and that Family Copilot cannot change events.
- **Make consent specific.** Show which account, calendars, fields, family members, and retention rules apply before import.
- **Let the guardian minimize access.** Calendars are off until selected, and each can expose event details or only busy times.
- **Show provenance and freshness.** Answers distinguish Outlook from Google events and disclose stale or disconnected sources.
- **Keep control reversible.** A guardian can pause sync, change visibility, disconnect, export, or delete imported data from one place.

### Primary users

- **Guardian:** connects provider accounts, confirms authority to use a child's calendar, chooses calendars and privacy levels, and manages or removes access.
- **Family member:** asks schedule questions and sees only information allowed by the family's sharing policy. A child is never asked to provide credentials to Family Copilot.

### Core journey

1. **Discover:** Calendar settings explain the read-only benefit, supported providers, data use, and the difference between event details and busy-only access.
2. **Connect Outlook:** The guardian selects **Connect Outlook**, reviews the requested read-only permission, completes Microsoft consent, and returns to Family Copilot.
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
| Calendar picker | Account identity, calendar owner/label, selection toggle, Details/Busy-only choice, and child-calendar attestation |
| Pre-import confirmation | Access summary, date window, family visibility, confirm and back actions; no event data is retrieved yet |
| Post-sync preview | Representative upcoming events exactly as the agent may disclose them, with source and privacy redaction visible |
| Agent response | Human-readable source, freshness indicator, privacy-safe event display, and no claim of completeness when a source is stale |
| Connection management | Pause/retry/reconnect, change selection or privacy, disconnect and revoke where supported, export, and delete |

Every asynchronous surface needs explicit loading, empty, partial, stale, permission-revoked, provider-unavailable, and unsupported-child-account states. Errors must explain whether existing results remain usable and offer a safe recovery action without exposing provider internals.

### UX acceptance criteria

- A guardian can understand the benefit and read-only boundary before leaving Family Copilot for provider consent.
- No events are imported until the guardian selects calendars, chooses their visibility, records whose schedules they represent, and confirms.
- The child-calendar flow establishes guardian authority and never requests the child's password.
- The post-connection preview matches what the agent may disclose, including private and busy-only redaction.
- Every schedule answer identifies its sources and freshness; stale or partial data is never presented as complete.
- A guardian can pause, reconfigure, disconnect, export, and delete calendar data without contacting support.
- Keyboard-only and screen-reader users can complete all steps, and status is not communicated by color alone.

UX prototypes and usability testing with guardians must validate this journey and terminology before provider adapters are implemented.

## Technical decisions derived from the UX

The first release will import events read-only from a parent's Outlook calendar and a child's Google calendar. A parent or verified guardian connects both sources, selects the calendars to include, and can disconnect or erase either source at any time. Write access is explicitly deferred until there is a separate user experience, threat review, and consent flow.

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
- Request delegated `Calendars.Read` for read-only calendar access, `offline_access` for a refresh token, and OIDC `openid` for a stable connected-account subject. Request `profile` only if the UX needs additional account display fields.
- Use `/me/calendars` for calendar selection and `/me/calendars/{calendar-id}/calendarView` to load occurrences from each selected calendar in a bounded time window. Microsoft Graph v1.0 [calendar view delta](https://learn.microsoft.com/graph/delta-query-events) supports the primary calendar, so use it there and store returned `@odata.nextLink` and `@odata.deltaLink` values as opaque secrets. Reconcile complete bounded snapshots for other selected calendars rather than relying on a beta per-calendar delta endpoint.
- Do not request application permissions or `Calendars.ReadWrite` in the first release. A future write feature must use a separate incremental-consent step for delegated `Calendars.ReadWrite`.

### Google Calendar

Use [Google Calendar API v3](https://developers.google.com/workspace/calendar/api/v3/reference) in a Google Cloud project with an OAuth consent screen.

- Use the OAuth 2.0 [web-server authorization flow](https://developers.google.com/identity/protocols/oauth2/web-server) with PKCE, `state`, OIDC `nonce`, an exact allowlisted HTTPS redirect URI, and offline access. The server exchanges the code, validates the ID token, and stores any refresh token.
- Request OIDC `openid` for a stable connected-account subject and `email` so the confirmation UI can identify the account. Request `https://www.googleapis.com/auth/calendar.calendarlist.readonly` so the parent can select an accessible calendar and `https://www.googleapis.com/auth/calendar.events.readonly` to read its events. Do not request the broader `calendar` scope.
- Use `calendarList.list` for selection and [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) for loading. Expand recurring events with `singleEvents=true` and retain the series identifier.
- Refresh Google calendars with bounded `events.list` queries using the same import window, `singleEvents=true`, and `showDeleted=true`, then reconcile the complete paged result. Do not combine `syncToken` with `timeMin` or `timeMax`; Google prohibits that combination. An unbounded sync-token strategy may be considered later only after a separate data-retention and privacy review.
- Do not request write scopes in the first release. A future write feature must use a separate incremental-consent step for `https://www.googleapis.com/auth/calendar.events`.

For a child's calendar, the preferred setup is for its owner or administrator to share the calendar read-only with a guardian-controlled Google account. The guardian then authorizes Family Copilot and explicitly selects that calendar. The application must not ask a child to share a password or capture a child's credentials. Workspace or supervised-account restrictions may prevent sharing or third-party OAuth; the UI must report that limitation rather than bypass it.

## Secure connection and token handling

Store one connection per provider account and family. The connection record contains the provider, provider account subject, granted scopes, token expiry, consent timestamps, and encrypted refresh credential.

Store a separate selection record for every connected calendar. It contains an internal connection reference, encrypted provider calendar ID, guardian-assigned family member, disclosure mode (`details` or `busy_only`), allowed family audience, consent-policy version and timestamp, lifecycle state (`active`, `paused`, or `disconnected`), and an optional per-calendar sync cursor. Authorization checks and redaction use this record rather than provider visibility alone.

Privacy reductions are fail-closed and atomic from the user's perspective. Changing from Details to Busy-only, narrowing the audience, or deselecting a calendar immediately blocks the old disclosure policy and queues deletion of no-longer-permitted fields from normalized records, caches, embeddings, and summaries. The UI shows the change as pending until cleanup succeeds and retries failures without restoring broader access.

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

- Poll each connected calendar initially every 15 minutes with jitter and exponential backoff. Respect provider throttling and `Retry-After`.
- Use Microsoft calendar-view delta links for the primary calendar. Treat its cursor as bound to the time window and request parameters; when rejected, clear it and repeat the bounded import. Reconcile complete bounded snapshots for non-primary Microsoft calendars.
- For Google, re-fetch and reconcile the complete bounded window because its sync tokens cannot be combined with the required time bounds. Page consistently, replace the previous snapshot only after a successful complete fetch, and rate-limit polling.
- Run a daily reconciliation import to recover from missed changes. Stop promptly when access is revoked or a calendar is deselected.
- Add provider webhooks later as a latency optimization, not as the source of truth. Validate webhook authenticity, use opaque subscription IDs, renew subscriptions, and still reconcile through each provider's authoritative refresh mechanism.

A delete action must atomically pause and deselect the affected calendar before purging its data so a scheduled refresh cannot re-import it. Resuming that source requires the guardian to select it again and complete a fresh access summary and confirmation.

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

## Read-only rollout and success criteria

The first release can list selected calendars, maintain a reliable normalized read model, answer schedule questions, and identify conflicts. It cannot create, edit, delete, accept, or decline events. UI copy and agent tools must make that boundary explicit.

Before rollout:

- OAuth threat-model tests cover CSRF, PKCE, callback replay, redirect validation, account linking, token leakage, and revocation.
- Adapter contract tests cover pagination, recurrence, all-day events, time zones, cancellations, throttling, expired cursors, and idempotent retry.
- Privacy tests confirm family isolation, private-field filtering, child-calendar deletion, audit redaction, and prompt-injection containment.
- Operational metrics cover sync age and failures without event content or provider identifiers.

Write actions are a later opt-in phase requiring narrow write scopes, explicit confirmation for every user-visible change, idempotency, conflict handling, a durable audit trail, and a rollback/correction experience.

## Follow-up implementation issues

These issues start with UX validation, then secure foundations, provider synchronization, and agent delivery:

1. **Prototype and validate the calendar connection journey:** Create accessible prototypes for discovery, consent explanation, calendar selection, visibility, preview, errors, and connection management. Test terminology and trust with guardians before fixing the implementation contract.
2. **Define calendar domain model and provider adapter contract:** Translate validated UX requirements into the normalized schema, migrations, adapter interface, mapping rules, and contract tests for recurrence, all-day boundaries, time zones, privacy, freshness, and deletion.
3. **Implement secure OAuth connection storage:** Implement Microsoft and Google PKCE callbacks, encrypted token storage and rotation, strict state/redirect validation, scope display, revocation, audit redaction, and family ownership checks.
4. **Build guardian consent and calendar privacy controls:** Implement guardian attestation, calendar-level selection, Details/Busy-only settings, audience controls, consent history, pre-import confirmation, fail-closed policy changes, content purge on privacy downgrade or deselection, export, provider-specific disconnect, deletion that stops re-import, and family-isolation tests.
5. **Implement Microsoft Graph read-only calendar adapter:** Add calendar selection, bounded `calendarView` import, primary-calendar delta, bounded snapshot reconciliation for other calendars, pagination, throttling, cancellation handling, and adapter contract tests using `Calendars.Read`.
6. **Implement Google Calendar read-only adapter:** Add calendar selection, bounded snapshot reconciliation, recurring-event expansion, pagination, deletion detection, throttling, and adapter contract tests using the two read-only scopes.
7. **Build sync orchestration and observability:** Add scheduled jobs, idempotent per-calendar checkpoints, retries with jitter, daily reconciliation, the post-sync privacy-safe preview, user-facing freshness and recovery states, content-free metrics, and disconnect cleanup.
8. **Add read-only schedule context to the agent:** Add least-data event retrieval, source and freshness indicators, schedule/conflict tools, prompt-injection boundaries, and authorization tests; expose no calendar mutation tools.

Issue 1 comes first. Issues 2 and 3 follow its validated decisions and can proceed in parallel. Issue 4 depends on 2 and 3; issues 5 and 6 depend on 2 and 3; issue 7 depends on 4 and both adapters; issue 8 depends on 7.

## References

- [Microsoft Graph calendar overview](https://learn.microsoft.com/graph/outlook-calendar-concept-overview)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)
- [Microsoft Graph calendar view delta](https://learn.microsoft.com/graph/delta-query-events)
- [Google Calendar API authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API synchronize resources](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
