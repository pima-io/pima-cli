---
name: customer-erasure
description: Process a customer privacy CSV through individual PIMA removal calls with local progress
when_to_use: When an authorized customer deletion queue must be processed in PIMA and Shopify
scopes: [customers:read, customers:write]
related: [getting-started, resources, recipes]
---

# Customer privacy removal

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
