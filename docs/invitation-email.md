# Invitation email infrastructure

## Scope and status

**Deployment succeeded (15 September 2026):** after the parent's explicit retry approval, guarded `resume` created `familycopilot-invitations-dev` and preserved `familycopilot-office365-dev`. The deployment record `familycopilot-invitation-bootstrap` reports `Succeeded` with no error. Subsequent independent reads confirmed workflow `Disabled`, SAS `Disabled`, one Entra caller policy, and `deliveryEnabled: false`. The preserved Outlook connection now reports **Connected**, following external interactive sender authorization. This supersedes the earlier `Error`/authorization-pending snapshot. No connection was reset or re-created, no mail was sent, and unrelated resources were not changed in this increment.

The parent has also explicitly approved the next live architecture and implementation/deployment: Azure Static Web Apps + Functions, independent invitation Storage, and Entra registration. [Read-only identity preflight](live-onboarding-preflight.md) found a concrete tenant credential-policy blocker before any new resources were created. This approval does not enable or invoke the email workflow; actual sending remains deferred until the complete flow is reviewed.

Earlier deployment attempts exposed restrictions not caught by ARM preflight: unsupported Parse JSON Secure Outputs, Request concurrency with synchronous Response, and `TriggerInputSchemaNotSupported` for a schema-validating Request trigger containing `pattern`. These are now corrected. The trigger retains type/length/required/additional-field checks; regex enforcement remains in the secured Parse JSON action before sending. Regression assertions protect this division. Deployment success does not prove runtime authentication, connector behavior, or delivery; those have not been tested.

The parent approved the adult Microsoft account connection journey and explicitly authorized an Azure Logic App for invitation emails on 14 September 2026. This is a narrow extension of the prototype boundary: user-requested onboarding emails, not meeting invitations, calendar writes, alerts, or child-account access.

This increment implements **the email delivery component only**, not a functioning invitee onboarding website. [The ARM template](../infra/invitation-email.logicapp.json) creates a Consumption Logic App and a separate Office 365 Outlook API connection. [The deployment helper](../scripts/invitation-infra.js) uses the already-installed Azure CLI and Node built-ins. The static UI now has a **+ → fictional email → invitation review** preview, documented in [the README](../README.md#email-first-invitation-entry-offline-preview). It does not call Azure, send mail, or retain real addresses in application state.

Both deployment and delivery are fail-closed:

- The workflow is deployed `Disabled`; the helper cannot enable or invoke it.
- `deliveryEnabled` defaults to `false`, the recipient is empty, and the application origin is `https://example.invalid`.
- The connection is created **without credentials**. The mailbox owner must authorize it interactively in Azure portal. Existing connections are not reused.
- No email is sent by deployment or tests. A public invitee website, invitation lifecycle, account authentication, and calendar consent are **not implemented** by this template.

## Delivery contract

The HTTP POST trigger accepts only `invitationToken`, a string exactly 43 characters long, and rejects additional fields. Before sending, Parse JSON additionally enforces base64url characters; the value is intended to represent a future cryptographically random 32-byte invitation token. Callers cannot supply recipients, subjects, HTML, sender addresses, attachments, or arbitrary URLs.

For this first operator-only increment, the one approved recipient is deployment configuration, not a request parameter. The recipient is a secure parameter at both ARM and workflow levels. An application origin is operator-controlled configuration; it must be a canonical HTTPS hostname with no credentials, port, path, query, fragment, or HTML characters. The template validates the recipient, origin, and token again before the email action. A syntactically valid origin is not proof of ownership or availability; verify the exact approved host and its onboarding behavior before enabling delivery.

The fixed English email has subject **You're invited to Family Copilot** and a **Review invitation** link at `/invite#token=…` on the configured origin. It explains that opening the link grants no calendar access, Microsoft sign-in and separate calendar/audience confirmation are required, personal/work details are not shared with another parent, and unexpected invitations can be ignored. No tracking images, attachments, event data, or child identifiers are included. This is a draft for review before the first send; that route does not exist in the prototype yet.

| Outcome | HTTP response | Meaning |
| --- | --- | --- |
| Delivery not configured | 503 / `delivery_not_configured` | No mail action attempted. A disabled workflow is rejected by Azure before this branch. |
| Invalid configured delivery fields | 400 / `invalid_delivery_configuration` | No mail action attempted. Invalid trigger payloads are rejected by Azure schema validation. |
| Outlook action succeeds | 200 / `provider_accepted` | Provider accepted the send action, not proof of inbox delivery, invite acceptance, or calendar access. |
| Outlook action fails or times out | 502 / `delivery_unknown` | Delivery might already have occurred. Do not retry automatically or mark it sent. |

The Office 365 Outlook `SendEmailV2` action uses POST `/v2/Mail`. Automatic connector retries are disabled because an ambiguous timeout can otherwise duplicate mail. Azure rejects Request-trigger concurrency controls when a workflow has synchronous Response actions; this workflow keeps synchronous, meaningful outcomes and does **not** implement rate limiting. Delivery remains off until a durable send ledger, per-actor/per-recipient rate limits, and invitation ownership checks are implemented. Outlook V2 does not return a message ID; do not fabricate delivery receipts.

## Authentication and privacy

The Request trigger disables SAS authentication and has one Entra authorization policy requiring **all** of issuer, audience, object ID, and application ID. An `Authorization` header prefix alone is never treated as authentication. No callback URL or bearer token is emitted by the template or helper.

The initial policy is a restricted **operator bootstrap**, not Family Copilot user authentication: the deployment helper selects the currently signed-in operator's object ID, the subscription tenant's v1 issuer, Azure CLI's application ID, and audience `https://management.azure.com/`. This only configures the policy; actual valid/invalid-token invocation has not been tested. Before connecting the application, replace this with a dedicated approved backend identity and API audience, verify token version/claims, and test denied callers as well as permitted callers. Do not put ARM tokens or Logic App endpoints into the static UI.

Incoming trigger outputs are protected in run history. Parse JSON supports **Secure Inputs only**, which also hides its outputs; its downstream email action explicitly secures both inputs and outputs. Public responses contain only fixed statuses. This is **not zero retention**: Azure persists workflow execution information and the mail service retains messages under the tenant's policies. Secure settings do not prevent privileged resource editors from changing the workflow. Review resource-group RBAC, connector consent permissions, run-history retention, and mailbox retention before processing real invitations. A workflow that only sends mail does not imply that its connector's OAuth grant is limited to `Mail.Send`. Tenant consent/Conditional Access restrictions must not be bypassed.

The future invitation service must own authoritative, expiring, revocable, single-use state, bind the invite to verified identities and the intended audience, and fence in-flight work after revocation/deletion. A token's format alone proves none of these. GET requests from email scanners must not consume invitations. Use a fragment to keep the token out of ordinary URL request logs, remove it from browser history promptly, and exclude it from analytics, telemetry, referrers, and application logs. The invitation website must require an explicit authenticated POST to accept; acceptance still cannot grant calendar consent or import events.

## Reusable deployment workflow

Run [the helper](../scripts/invitation-infra.js) with Node, selecting `check`, `validate`, `deploy`, `resume`, or `status`. It requires explicit `AZURE_SUBSCRIPTION_ID` and `AZURE_RESOURCE_GROUP` environment values and an already signed-in Azure CLI operator. Its `--help` describes usage. There are no dependencies to install. Never provide secrets through chat, source dotenv files as shell code, or log authorization headers.

- `check`: verify the existing resource group and location, target-name availability, and signed-in operator. It creates nothing.
- `validate`: the same preflight plus Azure ARM validation. No workflow or connection is created.
- `deploy`: validate, then incrementally create only `familycopilot-invitations-dev` and `familycopilot-office365-dev`. It never uses Complete deployment mode or creates a resource group, database, hosting plan, role assignment, or app registration. A name collision stops the operation rather than overwriting an existing resource, including resources from a partial previous deployment.
- `resume`: recover a reviewed partial bootstrap only when the workflow is absent and the existing connection matches the exact name/type, FamilyCopilot development/purpose tags, location, and Office 365 API ID. It excludes the connection resource from deployment and only creates the missing disabled workflow. It does not update, reauthorize, or delete the connection. This mode was added after Azure deployment (unlike preflight validation) rejected unsupported Parse JSON Secure Outputs; that setting has been corrected.
- `status`: read only the target resources' names/types, workflow state, SAS state, authorization-policy count, delivery flag, and connection status. It never prints connection credentials, recipient, invitation token, callback URL, or workflow content.

The helper intentionally does not support updates: review a separate narrow change after bootstrap, rather than accidentally resetting an authorized connector or enabling delivery. Azure errors are summarized without echoing potentially sensitive payloads; inspect detailed deployment errors in the portal. No automatic retry occurs after a partial/ambiguous deployment.

For the user-provided Azure resource group, read access and provider registration were verified. Azure template validation succeeded. What-if reported **Create** for only the new workflow and new connection, with no updates/deletions to the existing Cosmos DB or other resources. This does not establish that Azure is free: execution and connector usage follow the existing subscription's pricing/billing arrangement, which has not been audited.

## Activation handoff and remaining gates

1. Confirm the deployment result and leave the workflow disabled.
2. Sender authorization has been completed externally and the preserved connection reports **Connected**. Do not reauthorize or reset it as part of onboarding deployment. If a later status check reports an error, ask the sender to inspect it directly in the portal without routing credentials through the repository or chat.
3. Complete the reachable invitation website, adult identity/audience authorization, durable invitation/send state, rate limits, expiry/replay/revocation handling, and approved retention. Do not reuse the linked existing Cosmos DB without separate authorization for its data/schema use.
4. Review the recipient, exact email content and hostname; replace the bootstrap caller policy; run negative authentication and request-validation tests. Only then approve enabling and perform a controlled real send. Never send an invitation to the placeholder origin or the localhost prototype.
5. Implement and validate the separate Microsoft calendar picker/consent milestone. No calendar import until explicit calendar selection, represented-person labels, disclosure, audience, and access summary confirmation. Cross-parent personal/work context remains busy-only; the child Google feasibility and parent usability gates remain separate.

## Validation

Run `node --test` and `git diff --check`. [Offline infrastructure tests](../test/invitation-infra.test.js) check the shipped schema patterns/security configuration, protected steps, fixed responses, no automatic retries, deployment argument construction, explicit scope, collision rejection, and failure handling using mocked Azure CLI responses. These are **not** an Azure workflow emulator and do not prove runtime connector behavior, caller authentication, real mail delivery, or parent usability. This email/UI increment has 64 passing tests (52 UI/consent/invitation entry and 12 infrastructure). The subsequent [onboarding preflight](live-onboarding-preflight.md) adds 8 offline tests, bringing the executed full suite to 72 passing tests. Desktop/mobile browser observations for the invitation entry are recorded in the README; the original 44 app cases are retained with updated entry/focus expectations.

Official Microsoft references checked for this increment:

- [Consumption ARM templates and separate OAuth connection authorization](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-azure-resource-manager-templates-overview)
- [Workflow resource schema](https://learn.microsoft.com/en-us/azure/templates/microsoft.logic/2019-05-01/workflows)
- [Logic Apps access control, SAS disable, Entra policies, and secure run data](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-securing-a-logic-app)
- [Office 365 Outlook connector, Send an email V2, timeout duplication, and connection limitations](https://learn.microsoft.com/en-us/connectors/office365/)