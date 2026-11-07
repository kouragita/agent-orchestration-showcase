# Extensions

Two extracts, both from extensions I run daily, both reduced to the part that
demonstrates a decision.

| File | The decision it shows |
|---|---|
| [`sisyphus.example.ts`](sisyphus.example.ts) | inject policy by **appending** to the system prompt, so the cacheable prefix survives |
| [`router.example.ts`](router.example.ts) | roles have **model chains with cooldown state**, so a rate limit advances instead of failing |

## Why these are extracts, not the originals

They are close to the real files: same structure, same event names, same state
handling. What has been removed is what belongs to a specific machine or setup:
absolute paths, model identifiers, the workflow paths the policy refers to, and
the client repositories the harness runs against.

The `import type` lines reference a generic `harness-types` module so the shape of
the API is visible without shipping a dependency. **As published, these do not type
check**, deliberately: they are reading material, not a drop-in package. The
function signatures, the event names and the state handling are real.

## What a reader should take from them

1. **An extension is a hook plus a command.** The useful ones are small. Both of
   these are under 300 lines and replace behaviour that would otherwise be a
   wrapper script nobody maintains.
2. **State belongs on disk.** A toggle that resets every session is not a mode, it
   is a preference. Both files read and write a JSON file under the harness
   directory.
3. **Guard against recursion.** A subagent inherits the process environment. The
   `before_agent_start` hook returns early when it sees the child marker, or every
   child reinjects the policy and the tree grows without bound.
4. **Validate config on load.** The router drops malformed chain entries rather
   than trusting the file, because a bad config should degrade to fewer models,
   not to a crash in the middle of a task.
