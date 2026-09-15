---
name: customer-erasure
description: Remove approved customer data through PIMA and coordinate other services with their own tools
when_to_use: When processing an authorized customer privacy request or CSV, including downstream removal verification
scopes: [customers:read, customers:write]
related: [getting-started, resources, recipes]
---

# Customer privacy removal

PIMA owns local removal and its direct Shopify/Stripe integrations. The CLI
calls PIMA; the agent coordinates any other services using their own tools.
This skill does not install packages, authenticate providers, or execute
external removal by itself.

## Establish scope and resolve identifiers

Use the user's request and company runbook to identify the approved customers,
request IDs, applicable services, accounts, and retention requirements. Keep
company-specific service inventories and procedures in that private runbook,
outside the public PIMA CLI package. Do not assume every company uses the same
services or that Shopify erasure covers every downstream copy.

PIMA's removal action also submits linked Shopify erasure and prepares Stripe
validation; it has no local-only flag. If the user explicitly excludes either
of those side effects, hold that action and explain the need for a supported
local-only path. Do not bypass it with direct database edits or silently expand
approval. If only other external services are excluded, proceed with the
approved PIMA workflow and report those services as excluded and unverified.
For an end-to-end request, establish applicable service scope before claiming
complete removal. Existing explicit authorization remains valid; ask only for
missing scope, access, or consequences not already approved.

Resolve and retain the minimum identifiers needed for each applicable service
before a removal step clears them. Verify the account/environment and exact
customer match. If access blocks discovery and removal would destroy the only
remaining link, hold the destructive upstream action until the identifier is
safely retained; marking only the downstream service blocked is insufficient.
Continue independent, authorized work. A missing or ambiguous PIMA match does not prove the customer
is absent from other services.

## Connect external tools as needed

For each applicable service outside PIMA's Shopify/Stripe integration:

- Reuse an available authorized CLI/MCP and confirm its active account and
  permissions with a read-only check.
- If missing, consult the provider's current official documentation, install
  its supported CLI/MCP for the approved workflow, and complete its own login
  flow. Request the access needed for the operation and let the user complete
  interactive authentication when required. Verify the resulting account.
- Keep credentials in the provider's tool/auth store. Do not pass PIMA tokens
  to another service, copy credentials into checkpoints, or add provider SDKs,
  authentication brokers, or service-specific commands to the PIMA CLI.
- Inspect the supported deletion/redaction operation and its completion
  semantics. A connector may support reads without supporting erasure. If no
  suitable operation or required permission is available, record the blocked
  step and the provider/admin handoff; do not invent a CLI or deletion endpoint.

Execute supported operations for the approved scope. Prefer the provider's
preview or read-only lookup where available. Respect provider rate limits and
reconcile uncertain responses before resubmitting destructive operations.

## PIMA CSV workflow

Export the spreadsheet as UTF-8 CSV. The CLI finds Email and Request ID headers
within the first 20 rows, including OneTrust banners. Use --email-column and
--request-id-column for other headers. Limit: 10 MB and 10,000 data rows.

```sh
pima customer erasure preview requests.csv --out preview.json
pima customer erasure submit preview.json --yes
pima customer erasure status preview.json --out results.csv
pima customer erasure resume preview.json --yes
```

Preview calls exact email lookup for each distinct normalized email. It writes
a local plan with customer IDs, original request IDs, and match results. PIMA
does not store a batch or receive the spreadsheet. Review the source rows and
customer IDs before submitting. Missing, invalid, and ambiguous matches are
skipped; customers are never created. Duplicates share one customer operation
and retain all request IDs. An already removed email may match a retained HMAC.
If its customer record no longer exists, it is reported but cannot be retried
through the customer endpoint.

Submit only with authorization for the saved customer scope. Execution uses
the saved IDs without looking up emails again. The server checks expected_email
under the customer lock before removal; changed identities fail that customer.
Do not regenerate a preview while claiming it is the same approved scope.

Calls run sequentially by default. Add --concurrency 3 to submit/resume for up
to five simultaneous customer calls. Each customer commits independently.
The CLI saves progress atomically after each attempt, and status/resume read
the live state for each saved ID. Completed Shopify submissions are skipped;
new request IDs can still be appended to their audit record. Pending/failed
requests can be retried. A failed call exits nonzero after recording results.
Shopify submitted means the API accepted a request, not that erasure finished.

The JSON plan is also the checkpoint: retain it for resume. It contains raw
source emails and must be protected like the CSV. New files use owner-only
permissions and refuse overwrites; status/submit/resume update the plan itself.
CSV result exports omit emails and escape formula prefixes. Only one process
may update a plan at a time. After a killed process, confirm it has stopped
before removing the plan's .lock file and resuming. An interrupted request is
reconciled from live status before retrying the same customer ID.

For a single customer, existing generic CLI/MCP actions also work:

```sh
pima resource action customers 123 remove_personal_data --method post --data '{"request_ids":["REQUEST-1"]}' --yes
```

MCP pima_action can call the same member action in write mode. The server also
exposes POST /customers/removal_lookup.json (removal_email in the body, read
only), and GET /customers/:id/removal_status.json. Lookup/status need
customers:read, removal needs customers:write; all require customer-removal
permission and an active membership. Existing installations need the removal
migration, HMAC keys, and Shopify erasure scopes. These commands do not perform
OneTrust approval, verification, or request closure.

## Direct Stripe through PIMA

PIMA owns its direct Stripe integration. The CLI and MCP invoke the available
PIMA actions; they do not choose Stripe APIs, manage Stripe credentials, or
implement provider retries. Refresh `pima resource describe customers --refresh`
and inspect the action contract before acting. PIMA captures direct Stripe
references before local removal and reports their progress separately.

The CSV commands/checkpoint/results report PIMA and Shopify outcomes. Read
each customer's raw status separately for Stripe:

```sh
pima resource action customers 123 removal_status --method get --yes --json
```

Inspect `stripe_status` and every entry in `stripe_redactions`. Missing fields
or `unknown` mean coverage is unverified. `not_required` means no supported
references were captured, not proof that no historical or unlinked data exists.
A queued or accepted action never proves completion.

Use an entry's local `id` as `redaction_id` for the supported PIMA action:

```sh
pima resource action customers 123 stripe_redaction --method post --data '{"redaction_id":456,"operation":"check"}' --yes --json
```

Follow PIMA's reported readiness, restrictions, and next actions. Checking
never approves a destructive operation. `operation: validate` rechecks
eligibility; `operation: run` requires a ready result and explicit approval:
redacted payments cannot be refunded and their disputes cannot be challenged.
Preserve existing approval for that exact scope and consequence. Only
`succeeded` confirms broader Stripe redaction for a root; check all roots.

### Customer deletion is a separate outcome

When PIMA offers **Delete Stripe customer** for a captured root, approval must
cover irreversible deletion, removal of saved card details, and immediate
cancellation of active subscriptions. This does not complete broader
transaction-data redaction or the overall privacy request. Do not infer this
approval from a failed check. Existing explicit approval of these consequences
is sufficient.

After checking the PIMA action contract and approving the captured customer:

```sh
pima resource action customers 123 delete_stripe_customer --method post --data '{"redaction_id":456,"confirmation":"delete_stripe_customer"}' --yes --json
pima resource action customers 123 removal_status --method get --yes --json
```

MCP `pima_action` can invoke the same PIMA action/parameters in write mode.
Read `stripe_redactions[].customer_deletion`: `pending` means requested,
`uncertain` means unconfirmed, and `deleted` means PIMA verified deletion.
PIMA also reports requester/time and completion time. Follow its reconciliation
instructions before retrying an uncertain action; do not bypass it with direct
provider calls or alter captured identity/audit fields.

Report **Customer deleted; broader redaction pending** while broader redaction
is unfinished. Keep `customer_deletion.status` separate from `stripe_status`
and each root's redaction `status`. Unsupported roots remain unresolved by
customer deletion. Continue separately authorized redaction and downstream
verification; do not close the whole request because customer deletion succeeded.

## Track and verify the whole request

Maintain a separate agent-owned local checkpoint, for example
`privacy-progress.json`. PIMA CLI does not parse or update it. Do not add
third-party state to `preview.json`; the CLI owns and rewrites that format.

For each approved request/customer and applicable service, record the account,
resolved object IDs, approval scope, operation, remote job/request ID, status,
last check, completion evidence, and any blocker/next action. Use statuses such
as pending, submitted, completed, blocked, and not_applicable with an explanation.
Use excluded for services explicitly outside this task's scope; exclusion does
not mean a service is unused, has no customer data, or has completed removal.
Keep raw contact data only where needed for matching, protect the checkpoint
like the source CSV, and use the company's retention policy when work is done.

On resume, read provider status first and skip verified completed operations.
Do not expand the approved identifiers or replay every removal because one
service failed. Permission errors, missing tooling, and unverified absence are
blocked/unknown, not not_applicable or completed.

Where the company uses a warehouse or BI service, verify source changes reach
raw copies, derived models, and historical tables and cannot be restored by a
later sync/rebuild. Check BI caches, filter suggestions, uploaded datasets,
AI summaries, and scheduled/exported copies against the provider's current
retention/invalidation behavior. A source deletion alone does not verify those
copies. Use the data-platform owner's approved process for changes.

Report PIMA, Shopify, Stripe, and other applicable services separately, including
accepted requests still waiting for completion and any retained-data limits.
Report end-to-end completion only with the required evidence or explicitly
accepted exceptions, identifying any exceptions. Closing a request in another
system must also be within the user's authorized task. Successful PIMA CSV
processing alone is not end-to-end removal.
