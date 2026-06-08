---
name: comments
description: Read and create resource comments, including @-mentions
when_to_use: When you need comment threads, mention metadata, or to add an operational note to a PIMA record
scopes: [<resource-domain>:read, <resource-domain>:write]
related: [resources, versions, data-model]
---

# Comments

Comments are attached to records through the resource catalog. Always identify the resource and id first:

```bash
pima resource describe <resource>
pima resource comments <resource> <id>
pima resource comments <resource> <id> --mentionables
```

`pima resource comments` returns existing thread comments, `can_create`, and the current company mentionables. Mentionables include users and locations that can be referenced as `@name`.

Create a comment only when the user asked for a write:

```bash
pima resource comment <resource> <id> --text "Please review @nick" --dry-run
pima resource comment <resource> <id> --text "Please review @nick" --yes
```

Dry-run verifies the thread is readable and that PIMA says the caller can create comments, then prints the request without creating anything.

Scope rules:

- reading comments requires read access to the resource domain
- creating or deleting comments requires write access to the resource domain
- PIMA resolves @-mentions server-side from the text body

Use `--json` when you need exact `mentioned_users`, anchors, or paths for follow-up automation.
