---
name: migration-verification
description: >
  Prove a data migration instead of hoping. Use when moving records between
  databases, backfilling a column across a large table, consolidating two
  systems, or reconciling counts after a bulk load.
  Triggers: migration, backfill, bulk load, reconcile, row count, checksum,
  orphaned records, data loss, cutover.
  Does not cover application-level schema changes on an empty database.
allowed-tools: read, exec, write
---

# Migration verification

A migration is not finished when it runs. It is finished when you can show that
nothing was lost, and the only person who should accept that proof is the one who
would be blamed for the loss.

Work in phases. **No phase runs until the previous phase's harness passes.**

## Before anything moves

Write down the numbers you expect, not the numbers you get.

- Row count per table, not per database. A total that matches can hide two tables
  that swapped deficits.
- Null and empty-string counts for every column that is supposed to have a value.
- Sum, min and max for every monetary and date column.
- Count of rows per status or state column, because that is where transitions
  silently vanish.

Store this as a file in the repository. A baseline that lives only in a terminal
session is not a baseline.

## For each phase

1. **Load into a new table or schema.** Never in place. The old state is the
   rollback.
2. **Count.** Source rows, loaded rows, and the difference. The difference must be
   the number of rows you deliberately excluded, and you must be able to name
   them.
3. **Reconcile on identity.** Join source to target on a stable key and count the
   rows with no match in either direction. Report orphans by table.
4. **Reconcile on values.** For each field with a transformation, compare
   source-derived value to target value. Report mismatches with example keys, not
   just a count, because a count of 12 is unauditable and 12 example keys are not.
5. **Checksum.** Sum of money columns, max timestamp, count of distinct owners. A
   checksum that both sides agree on is the cheapest evidence in the whole
   exercise.
6. **Record the result.** Written to an artifact, with the phase id, the numbers,
   and the pass or fail. This is what an auditor reads.

## The rules that matter

**A count that matches is not proof.** Two different sets can have the same size.
Reconcile on identity and on value, not on cardinality.

**Every phase needs a tested rollback path.** "Tested" means it has been run once
against a copy and the previous state restored. A rollback plan that has never
executed is a wish.

**Never verify with the writer.** Run the reconciliation from a separate process
with a separate connection, so a bug in the loader cannot also be a bug in the
checker. The harness that certifies the load must not share code with the load.

**Duplicates are a first-class check.** Bulk loads retry. A retry that inserts
twice produces a database that looks correct and bills customers twice. Count
distinct business keys in source and target.

**Sample the nulls.** A column that was 4% null in source and is 9% null in target
lost data somewhere, and the row counts will not show it.

## Output

End with a short report a non-author can read:

```
phase:      orders_header
source rows:        1,284,003
target rows:        1,284,003
excluded:                   0
orphans:                    0
value mismatches:           0
checksum (amount):  411,203,882.15  ==  source
result:                  PASS
```

If any line is not a pass, the phase does not advance and the next phase does not
start. That is the whole discipline, and it is the reason a 28-million-record
migration can be reported to a customer as "nothing lost" rather than "probably
fine".
