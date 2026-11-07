# The loop: planner → worker → oracle

The default single-model loop is: you ask, the model answers, you decide whether
to believe it. In a codebase with tests and a deadline, the weak point is the
third step, because the model has just certified its own work.

This workflow puts a hand between step two and step three.

```
goal
 └── planner   → ordered tasks, files, acceptance checks, dependencies, risk
      └── worker  → executes the plan
           └── oracle → reviews against the acceptance checks, and may block
```

**The oracle can block, and the block is honoured.** If the reviewer says the
acceptance checks are not met, the run does not report success. That single rule
is what makes the output worth reading.

## Each role has a model chain, not a model

```
planner: [ strong-reasoning, fast-reasoning, budget ]
worker : [ strong-coding,   fast-coding,    budget ]
oracle : [ strongest-reviewer, alternate-reviewer, budget ]
```

A launch fails when a model is rate limited or out of quota, both of which are
normal. The chain advances to the next model rather than failing the goal, and the
attempt log records which model actually ran each role, so a result can always be
attributed. See [`../extensions/router.example.ts`](../extensions/router.example.ts).

## Proportionality is the cost control

Running planner → worker → oracle on a rename is waste: three model calls, three
sets of tokens, to produce a one-line change. So the trigger is written into the
policy itself, and it is deliberately narrow:

| Use the loop | Skip it |
|---|---|
| multi-file change | single-file edit |
| migration or schema change | rename |
| behaviour change with risk | reading code |
| ambiguous enough that a plan prevents rework | a pure question |
| the user asked for a review | a model comparison |

The loop is the expensive path, so the cheapest useful thing an agent can do is
recognise when it is not needed. That is the same instinct as keeping the skill
index small, and it is the difference between spending tokens and maxing them.

## Why the reviewer must be a different context

An agent that has just written code knows what it intended. Reviewing its own work
means reviewing its intentions, not its output. A separate reviewer with only the
goal, the acceptance checks and the diff cannot inherit the author's assumptions,
which is exactly the blindness the step exists to catch.

This is the same principle as the migration rule that the checker must not share
code with the loader. Independence is the feature.

## What comes out

An evidence artifact, not a claim:

```
goal:            add a closure gate to the posting filter
planner:         model-a      5 tasks, 2 flagged risky
worker:          model-b      edited 3 files
oracle:          model-c      BLOCKED once, then APPROVED
acceptance:      fixtures 19/19, full run 80 -> 6 kept, closed 1 -> 0
report:          results/example-run.md
```

See [`../results/example-run.md`](../results/example-run.md) for the run above in
full, including the part that failed.
