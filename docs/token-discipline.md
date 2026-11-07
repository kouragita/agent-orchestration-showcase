# Spending tokens instead of maxing them

An agent session has three costs: the tokens you send, the tokens the provider
caches, and the tokens you pay for because the harness was careless. Only the
third is under the harness's control, and it is usually the largest.

These are the decisions that turn 18 repositories' worth of context into something
that runs in one window.

## 1. The system prompt is the cacheable prefix, so keep it stable

It sits at the front of every request. If the start of it changes, the provider's
prompt cache misses, and you pay full price for the whole prefix on every turn.

```
PREPEND (invalidates cache)     APPEND (keeps cache warm)
[ new policy ][ old prompt ]    [ old prompt ][ new policy ]
       ^ changes byte 0                ^ prefix identical
```

So a policy injected at runtime is appended. This is one line of the extension in
[`../extensions/sisyphus.example.ts`](../extensions/sisyphus.example.ts), and it
is there for cost reasons, not style.

## 2. Load descriptions always, documents on demand

A library of 106 skills, fully loaded, is a context window spent before the work
starts. As an index it is 106 short lines:

```
always loaded      name + description + triggers   ~100 lines
loaded on trigger  the body of the one that matched  ~300 lines
```

The same rule applies to tool schemas. List the tools, describe one, call it. A
harness that dumps its full tool catalogue into every prompt is paying for
capability it is not using.

## 3. Do not run the expensive loop on cheap work

Planning, working and reviewing a one-line rename costs three model calls to
produce nothing you did not already have. The trigger for the loop is deliberately
narrow, and most tasks do not meet it. Recognising when the cheap path is correct
is the highest-leverage token decision available, and it requires judgement rather
than configuration.

## 4. Cool down on quota, do not retry

A quota-exhausted model will stay exhausted for hours. A retry loop against it
produces zero work and full cost. Mark it cooling for six hours, move to the next
model in the chain, and log which model actually ran.

This is also why chains are data. Changing which model serves a role is a config
edit, not a release, and the attempt log keeps every result attributable.

## 5. Give the worker the files, not the repository

A task that needs three files does not need the tree. Retrieval by symbol and by
path keeps the context proportional to the change, and the plan says which files
are in scope before any of them are read.

## What this adds up to

The measure is not tokens per session. It is **tokens per verified result**. A
session that spends three times as much and produces a change nobody has to
re-check is cheaper than a fast one that produces a claim.

The guard against optimising the wrong number is the reviewer at the end of the
loop: it refuses results that were cheap because they were unverified.
