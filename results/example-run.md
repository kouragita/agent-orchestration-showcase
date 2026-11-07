# One real run, including the part that failed

This is a run I did on a personal job-hunting pipeline: a Python tool that polls
job sources, filters postings against a profile, and reports only what is new. It
is a good specimen because it is small enough to verify by hand, and because the
first two attempts at the fix were wrong.

## The report that started it

```
  33  DevOps Engineer · Simple Analytics · remote · €5,000/month
      https://example.org/jobs/devops
```

The employer's own page, when fetched, said:

> DevOps engineer (applications closed).

A posting that had stopped accepting applications was being ranked at 33 and
offered as a live opportunity. One is a bad recommendation. A pattern of them
destroys trust in the tool, because the user stops reading.

## Build

A gate, in the filter chain, placed after the body-length check so it only runs on
real text:

```python
CLOSED = re.compile(
    r"(?:\bapplications?\s+(?:are|is|have|has)?\s*(?:now\s+)?closed\b"
    r"|\bno\s+longer\s+(?:accepting|taking|reviewing)\s+applications?\b"
    r"|\bnot\s+(?:currently\s+)?accepting\s+(?:any\s+)?applications?\b"
    r"|\b(?:this|the)\s+(?:job|role|position|vacancy|posting)\s+"
    r"(?:is\s+(?:now\s+)?(?:closed|expired|withdrawn)"
    r"|(?:has\s+been|was)\s+(?:now\s+)?(?:closed|filled|withdrawn))\b)",
    re.I,
)
```

Every branch is anchored to a completed state, because the live version of the
same sentence is one word away: **"applications close on 15 November"** is an open
role and must survive.

## Verify, round one: the fixture that caught me

19 fixture sentences, live and dead. One failed on the first attempt:

```
FAIL live | 'Applications are open until the role is filled.'
          -> matched "the role is filled"
```

A future condition matched a past state. The fix was to stop treating bare "is
filled" as evidence and require "has been filled" or "was filled", plus a guard on
the 24 characters before the match:

```python
CLOSED_SOFT = re.compile(r"\b(?:until|once|if|unless|before)\s+(?:the\s+|this\s+)?$", re.I)
```

19 of 19 passed on the second run. The gate had a passing unit test and precise
anchoring. It was ready.

## Verify, round two: it still did not fire

The full pipeline ran, and the Simple Analytics posting came back at **33 again**.

The gate was correct. The input was wrong. That row's body was not the employer's
page at all, it was a **Hacker News comment** written by a person describing the
job. The comment was long enough to pass the body-length check, so nothing had
ever fetched the real posting, and the phrase "applications closed" existed only
on a page the pipeline had never read.

The fix was one line, and it was not in the gate:

```python
# A comment is a person describing a job, not the posting. Length is not
# evidence that the body is complete.
ALWAYS_ENRICH = {"jobsinkenya", "careerpointke", "kenyanjobs", "weworkremotely",
                 "hackernews", "campusbiz"}
```

## Report

Full run after the fix:

```
fetched 3,679 · kept 6 · new 0
dropped: closed 1 · exclude 25 · geo 183 · level 798 · role 728
         stale 1,740 · unverified 136 · years 62
```

And the independent measurement tool, which reruns the same pipeline with the
gates off and on and counts problems with separate logic from the engine:

| metric | gates off | gates on |
|---|---:|---:|
| postings considered | 3,679 | 3,679 |
| kept after filtering | 80 | 6 |
| ...closed postings | 1 | **0** |
| ...geography leaks | 35 | 0 |
| ...demands 5+ years | 29 | 0 |

The closing number is the one that mattered: the tool no longer recommends a job
that has stopped hiring.

## What this run is actually evidence of

Two failures, caught by two different checks, neither of which was the unit test.

1. **The fixture caught a regex bug.** Cheap, local, would never have surfaced in
   production because nobody writes that sentence in a test by accident.
2. **The full run caught an architectural bug.** The unit test passed *because the
   gate was fine*. The defect was that the pipeline was reading the wrong
   document, which no amount of testing the gate could reveal.

The second is the reason the loop ends with a reviewer who has the whole system
and not just the diff. A worker with a green test suite would have closed this
ticket as done.
