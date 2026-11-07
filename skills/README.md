# Skills

A skill is a folder with a `SKILL.md` in it. That is the whole mechanism.

```markdown
---
name: migration-verification
description: >
  Prove a data migration before and after it runs. Use when moving records
  between databases, backfilling a column, or reconciling two systems.
  Triggers: migration, backfill, reconcile, record count, checksum.
allowed-tools: read, exec, write
---
```

The frontmatter is the **routing spec**. The body is the procedure.

## Why this is a token decision, not a formatting decision

A library of 106 skills, loaded naively, is 106 documents in every prompt and the
context window is gone before the work starts. Loaded as an index, it is 106 short
descriptions, and only the matching one is expanded.

```
index loaded always     ~100 skills × 1 line    cheap
body loaded on trigger  1 skill × 300 lines     only when relevant
```

That is the difference between token maxing and running 18 repositories from one
session. The index is also the cacheable part: it changes rarely, so a stable
prefix means the provider cache keeps hitting.

## Spec-driven, which means the description is code

A skill fires because its description matched, so a skill that triggers on the
wrong task is not a prompt problem, it is a bug in the spec. The description gets
the same treatment as a function signature:

- name the *situation*, not the technology
- list the words a person would actually use
- say what it does **not** cover, so neighbouring skills do not collide

```markdown
description: >
  Diagnose why a program crashed, from a core dump. Use when a process has
  segfaulted or dumped core.
  Triggers: crash, segfault, SIGSEGV, coredumpctl, backtrace.
```

Then the body starts with the rule that keeps it honest:

> Work from evidence. The goal is an honest account of what happened, not a
> plausible-sounding story.

## Environments

One skill, not one per machine. A skill that touches the system carries an
environment section, because the *workflow* is the same and only the specifics
differ:

| Environment | What changes |
|---|---|
| Arch / Omarchy | `systemd`, `coredumpctl`, `pacman` |
| Debian / Ubuntu | same shape, different package manager |
| WSL | interop paths, no systemd by default, `/mnt/c` boundaries |

Forking a skill per machine means five skills drift apart. One skill with an
environment section means the procedure is fixed and the specifics are looked up.

See a full worked example in
[`example-migration-verification/`](example-migration-verification/SKILL.md).

## What a skill is not

It is not a prompt template and it is not documentation. A skill earns its place
only if it changes behaviour: it must contain a rule, a threshold or a check that
a competent engineer would otherwise get wrong on a bad day. "How to write good
code" is not a skill. "Never let phase N+1 run before phase N's harness has
passed, and here is the harness" is a skill.
