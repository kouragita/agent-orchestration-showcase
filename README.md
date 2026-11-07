# Agent orchestration showcase

A sanitised extract of a personal agent harness I build and run daily for
engineering work. Not the whole setup: examples of the four pieces that matter,
with the parts that are mine to keep left out.

The point of the repository is one claim, and it is checkable: **the interesting
work in agent systems is not the model call, it is what surrounds it.** Routing,
skill selection, tool access and verification are engineering decisions, and they
are where cost and correctness are actually decided.

---

## The problem this solves

Every harness looks the same from the outside. They stream tokens, they offer
tool calls, they let a model respond. The differences that matter are:

| Question | Where it is answered |
|---|---|
| Which model handles this task, and what happens when it is rate limited? | routing chains with cooldown state |
| How does the model know *how* to do this kind of task, without a 40-page prompt? | skills, activated by trigger and loaded on demand |
| How does it reach a system it has never seen? | MCP tool servers, discovered at runtime |
| Who checks the work before I claim it is done? | a mandatory reviewer agent, not the author |

The last one is the difference between an agent that produces output and an agent
whose output you can rely on.

---

## Architecture

```
session start
  ├── extension: inject policy into the system prompt
  │     appended, never prepended, so the cacheable prefix stays intact
  ├── skill index: name + description + triggers only  (cheap)
  │     body loads only when a trigger matches         (expensive, deferred)
  ├── tool access over MCP
  │     list servers → describe one tool → call it
  │     schemas fetched on demand, not up front
  └── workflow, when the task is risky enough to earn it
        planner → worker → oracle (veto)
             ↓
        evidence artifact: what ran, what passed, what did not
```

Three of those four are cost decisions as much as design decisions. See
[`docs/token-discipline.md`](docs/token-discipline.md).

---

## Contents

| Path | What it shows |
|---|---|
| [`skills/`](skills/) | how a skill is written, and why only its description is loaded |
| [`skills/example-migration-verification/`](skills/example-migration-verification/) | a real skill for proving a data migration before it runs |
| [`mcp/`](mcp/) | how tool servers are wired, and why not a hardcoded client |
| [`extensions/`](extensions/) | two TS extensions: policy injection, and model routing |
| [`loop/`](loop/) | planner → worker → oracle, and when *not* to use it |
| [`results/`](results/) | one real run, with the numbers and the mistake I made |

---

## Real results from this harness

Work done with it, not hypothetical:

- **28 million records**, 128 legacy tables into PostgreSQL, **nothing lost**.
  Gated by 40 reconciliation harnesses, each of which had to pass before the next
  phase was allowed to run.
- **A payment platform's callbacks** (M-Pesa collections and disbursement),
  where a missed callback is a customer who has paid and does not know it.
- **This repository**, written by the harness it describes, which is either
  neat or incestuous depending on your taste.

The migration work is the clearest example of the build → verify → report loop in
use, because the failure mode there is silent data loss and the only defence is
evidence.

---

## What is in here, and what is not

**Included**, because it demonstrates the design: skill format and activation,
MCP wiring shape, two extension extracts, the review loop, one real run.

**Excluded**, because it is not mine to publish or not useful to a reader: client
and repository names, credentials and endpoints, model and provider identifiers,
the full skill library, and the private workflows this runs against day to day.

Everything here is a **pattern with a working example**, not a deployment.

---

## Environments

The same harness runs on Arch-based Linux (Omarchy) and on WSL, and the skills
carry the differences rather than forking per machine. A skill that shells out has
one section for `systemd` and one for WSL interop, so the workflow is identical
and only the specifics change. See [`skills/README.md`](skills/README.md#environments).

---

## Licence

MIT for the code extracts. The prose is mine; take the ideas.
