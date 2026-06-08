---
name: feedback
description: File PIMA bugs, ask async implementation questions, and request features from an agent session
when_to_use: When an agent needs to report a PIMA bug, ask a PIMA/codebase question, or request a product/code change
scopes: [feedback:write]
related: [getting-started, resources, comments, versions]
---

# Feedback

The CLI supports three feedback actions:

```bash
pima feedback bug --title "Order export returns 500" --request-id req_123 --status 500 --yes
pima feedback question --title "Which resource owns transfer damage state?"
pima feedback feature --title "Add saved transfer filters" --description "Agents need reusable views." --yes
```

Bugs and feature requests create GitHub issues with sanitized context. Bugs and
features are Codex PR candidates by default.

Questions create async answer threads. PIMA runs a read-only, non-TTY Codex
session against the PIMA codebase, stores the answer, and returns it to the CLI:

```bash
pima feedback question --title "Which resource owns transfer damage state?" --no-wait
pima feedback status q_123 --wait
pima feedback follow-up q_123 --message "Which endpoint exposes that?"
```

Use questions for product/API/codebase guidance. Do not use questions to request
code changes; use `bug` or `feature` instead.

## Server errors

If a PIMA API call returns a `500`, file a bug report when you have
`feedback:write`. If you do not have that scope, prepare the same payload with
`--dry-run` and ask the user to re-auth with feedback access. Include:

- `request_id`
- command
- resource/action
- status
- sanitized error message
- CLI version
- any direct PIMA URL or resource link that helps reproduce it

Do not include tokens, cookies, gift codes, credit codes, full customer PII, or
raw response bodies. Use `--dry-run` first when unsure:

```bash
pima feedback bug --title "Order export returns 500" --request-id req_123 --status 500 --dry-run
```

## Scope

Filing feedback and asking follow-ups require `feedback:write`. Reading question
status requires `feedback:read`; `feedback:write` includes it.
