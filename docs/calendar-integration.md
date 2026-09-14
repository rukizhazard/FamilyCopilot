# Outlook and Google Calendar integration plan

## Decision summary

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

- Use the OAuth 2.0 [authorization code flow with PKCE](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow). Generate and verify `state` and `nonce`, use an exact allowlisted HTTPS redirect URI, and perform the code exchange on the server.
- Request delegated `Calendars.Read` for read-only calendar access and `offline_access` for a refresh token. Request OIDC `openid` and `profile` only when they are needed to identify the connected account.
- Use `/me/calendars` for calendar selection and `/me/calendarView` to load occurrences in a bounded time window. Use [calendar view delta](https://learn.microsoft.com/graph/delta-query-events) to track additions, updates, and deletions; store returned `@odata.nextLink` and `@odata.deltaLink` values as opaque secrets.
- Do not request application permissions or `Calendars.ReadWrite` in the first release. A future write feature must use a separate incremental-consent step for delegated `Calendars.ReadWrite`.

### Google Calendar

Use [Google Calendar API v3](https://developers.google.com/workspace/calendar/api/v3/reference) in a Google Cloud project with an OAuth consent screen.

- Use the OAuth 2.0 [web-server authorization flow](https://developers.google.com/identity/protocols/oauth2/web-server) with PKCE, `state`, an exact allowlisted HTTPS redirect URI, and offline access. The server exchanges the code and stores any refresh token.
- Request `https://www.googleapis.com/auth/calendar.calendarlist.readonly` so the parent can select an accessible calendar and `https://www.googleapis.com/auth/calendar.events.readonly` to read its events. Do not request the broader `calendar` scope.
- Use `calendarList.list` for selection and [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) for loading. Expand recurring events with `singleEvents=true` and retain the series identifier.
- Follow Google's [incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync): retain `nextSyncToken`, reuse the same compatible query parameters, and perform a bounded full resync if Google returns HTTP `410 Gone`.
- Do not request write scopes in the first release. A future write feature must use a separate incremental-consent step for `https://www.googleapis.com/auth/calendar.events`.

For a child's calendar, the preferred setup is for its owner or administrator to share the calendar read-only with a guardian-controlled Google account. The guardian then authorizes Family Copilot and explicitly selects that calendar. The application must not ask a child to share a password or capture a child's credentials. Workspace or supervised-account restrictions may prevent sharing or third-party OAuth; the UI must report that limitation rather than bypass it.

## Secure connection and token handling

Store one connection per provider account and family. The connection record contains the provider, provider account subject, selected calendar IDs, granted scopes, sync cursor, token expiry, consent timestamps, and encrypted refresh credential.

- Keep client secrets and encryption keys in a managed secret store; never ship them to a browser or mobile client.
- Encrypt refresh tokens with envelope encryption and a managed KMS key. Restrict decryption to the synchronization service, rotate keys, and keep production credentials out of source control.
- Store access tokens in memory or an encrypted short-lived cache only. Rotate refresh tokens when a provider returns a replacement and revoke them on disconnect.
- Never log authorization codes, tokens, opaque sync links, raw event bodies, attendee addresses, or calendar IDs. Use generated internal IDs and structured redaction.
- Enforce tenant/family ownership on every connection and event query. Separate OAuth callback state from user-supplied return URLs to prevent account-linking and redirect attacks.
- Record connect, scope change, calendar selection, sync, export, disconnect, and deletion actions in a metadata-only audit trail.

## Loading and refresh

### Initial import

1. After consent, list accessible calendars and require the guardian to select each source explicitly.
2. Import a configurable bounded window (initially 30 days in the past through 365 days in the future), paging until complete.
3. Upsert normalized events by `(connection_id, provider_calendar_id, provider_event_id, occurrence_key)` and apply provider cancellation/deletion markers.
4. Save a sync cursor only after all pages commit successfully. If a page fails, retry idempotently without advancing the cursor.

### Incremental refresh

- Poll each connected calendar initially every 15 minutes with jitter and exponential backoff. Respect provider throttling and `Retry-After`.
- Use Microsoft calendar-view delta links and Google sync tokens rather than repeatedly downloading the full window.
- Treat cursors as bound to the calendar, time window, and request parameters. When a cursor expires or is rejected, clear it and repeat the bounded import.
- Run a daily reconciliation import to recover from missed changes. Stop promptly when access is revoked or a calendar is deselected.
- Add provider webhooks later as a latency optimization, not as the source of truth. Validate webhook authenticity, use opaque subscription IDs, renew subscriptions, and still reconcile by delta.

Store provider timestamps in UTC while preserving the provider time-zone identifier and the original all-day date boundaries. Recurrence exceptions, cancellations, and moved occurrences must remain distinguishable. The agent must not infer that imported events are current if a connection is in an error or stale state.

## Common event model

```text
CalendarEvent
  id: UUID
  family_id: UUID
  connection_id: UUID
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
- Provide export, disconnect, and deletion controls. Disconnect revokes provider access and queues tokens, cursors, normalized events, caches, and derived embeddings/summaries for deletion under a documented retention SLA; retain only legally required audit metadata.
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

These issues are ordered so that security and the shared contract land before provider-specific synchronization:

1. **Define calendar domain model and provider adapter contract:** Add the normalized schema, migrations, adapter interface, mapping rules, and contract tests for recurrence, all-day boundaries, time zones, privacy, and deletion.
2. **Implement secure OAuth connection storage:** Implement Microsoft and Google PKCE callbacks, encrypted token storage and rotation, strict state/redirect validation, scope display, revocation, audit redaction, and family ownership checks.
3. **Implement Microsoft Graph read-only calendar adapter:** Add calendar selection, bounded `calendarView` import, pagination, delta links, throttling, cancellation handling, and adapter contract tests using `Calendars.Read`.
4. **Implement Google Calendar read-only adapter:** Add calendar selection, bounded event import, recurring-event expansion, pagination, sync tokens, `410` recovery, throttling, and adapter contract tests using the two read-only scopes.
5. **Build sync orchestration and observability:** Add scheduled jobs, idempotent checkpoints, retries with jitter, daily reconciliation, stale-state reporting, content-free metrics, and disconnect cleanup.
6. **Build guardian consent and calendar privacy controls:** Add guardian attestation, calendar-level selection, private/free-busy filtering, consent history, export, disconnect, deletion, and family-isolation tests.
7. **Add read-only schedule context to the agent:** Add least-data event retrieval, freshness indicators, schedule/conflict tools, prompt-injection boundaries, and authorization tests; expose no calendar mutation tools.

Issues 1, 2, and 6 can start in parallel. Issues 3 and 4 depend on 1 and 2; issue 5 depends on both adapters; issue 7 depends on 5 and 6.

## References

- [Microsoft Graph calendar overview](https://learn.microsoft.com/graph/outlook-calendar-concept-overview)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)
- [Microsoft Graph calendar view delta](https://learn.microsoft.com/graph/delta-query-events)
- [Google Calendar API authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
