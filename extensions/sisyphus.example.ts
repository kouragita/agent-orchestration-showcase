/**
 * sisyphus.example.ts
 *
 * A sanitised extract of a real harness extension. It does three things:
 *
 *   1. Injects a working policy into the system prompt at session start.
 *   2. Registers a command, with argument completion, to toggle that policy.
 *   3. Persists the toggle to disk so it survives the session.
 *
 * The interesting decision is in point 1: the policy is APPENDED, not
 * prepended. The system prompt is the cacheable prefix of every request in a
 * session, so changing its start invalidates the provider's prompt cache on
 * every turn. Appending keeps the prefix stable and the cache warm.
 *
 * Run against a host harness that exposes an ExtensionAPI. The guard on
 * CHILD_ENV matters: a subagent inherits the process environment, and without it
 * every child would reinject the policy and recurse.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "harness-types";

type State = { enabled: boolean };

const STATE_PATH = join(homedir(), ".harness", "reviewed-mode.json");
const MARKER = "REVIEWED MODE IS ON";
const CHILD_ENV = "SUBAGENT_CHILD";

const POLICY = `## Reviewed mode

Reviewed mode is ON. This is the top-level session; subagents ignore this section.

Use the planning and review workflow only when the task is:
- multi-file, or a migration/refactor/behaviour change with risk
- ambiguous enough that a plan would prevent rework
- work the user explicitly wants reviewed

Do not use it for a single-file edit, rename, small test, a pure question, or
reading code. Act directly for those.

When it applies, plan first, then work, then require review before claiming
completion. The workflow costs a planner, a worker and a reviewer, so keep it
proportional to the risk.`;

function readState(): State {
  try {
    const value = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<State>;
    return { enabled: value.enabled === true };
  } catch {
    return { enabled: false };
  }
}

function writeState(state: State): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

export default function (pi: ExtensionAPI) {
  // Append, never prepend: the cacheable prefix stays byte-identical.
  pi.on("before_agent_start", (event) => {
    if (process.env[CHILD_ENV]) return;
    if (!readState().enabled) return;
    if (event.systemPrompt.includes(MARKER)) return;
    return { systemPrompt: event.systemPrompt + "\n\n" + POLICY };
  });

  const handler = async (args: string, ctx: ExtensionCommandContext) => {
    const command = (args.trim().split(/\s+/)[0] || "").toLowerCase();

    if (command === "on" || command === "off") {
      const enabled = command === "on";
      writeState({ enabled });
      ctx.ui.notify(enabled ? "Reviewed mode ON." : "Reviewed mode OFF.", "info");
      return;
    }

    ctx.ui.notify(
      `Reviewed mode: ${readState().enabled ? "ON" : "OFF"}\n\n` +
        "  reviewed-mode on|off|status|run <goal>",
      "info",
    );
  };

  const completions = (prefix: string) =>
    ["on", "off", "status", "run "]
      .filter((item) => item.startsWith(prefix))
      .map((value) => ({ value, label: value }));

  pi.registerCommand("reviewed-mode", {
    description: "Toggle plan and review mode for risky work",
    getArgumentCompletions: completions,
    handler,
  });
}
