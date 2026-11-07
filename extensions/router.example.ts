/**
 * router.example.ts
 *
 * A sanitised extract of the extension that decides which model runs a role,
 * and what happens when that model is unavailable.
 *
 * Two ideas, both about not wasting money or time:
 *
 *   1. A ROLE has an ordered chain of models, not one model. Rate limits and
 *      quota exhaustion are normal operating conditions, not errors, so the
 *      chain advances instead of failing the task.
 *
 *   2. A model that fails with a quota reason goes into COOLDOWN for hours,
 *      not seconds. Retrying a quota-exhausted model in a loop burns the
 *      session, the budget, and the user's patience while producing nothing.
 *
 * Chains are data, not code: they live in a JSON file so a model can be added
 * to a role without a release.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "harness-types";

/** role -> ordered model identifiers */
type Chains = Record<string, string[]>;

type Cooldown = {
  until: number;
  reason: string;
  failures: number;
  updatedAt: number;
};

type State = { models: Record<string, Cooldown> };

const ROUTER_DIR = join(homedir(), ".harness", "router");
const STATE_PATH = join(ROUTER_DIR, "cooldowns.json");
const CHAINS_PATH = join(ROUTER_DIR, "chains.json");

const QUOTA_COOLDOWN_MS = 6 * 60 * 60 * 1000; // six hours, not six seconds
const TRANSIENT_COOLDOWN_MS = 2 * 60 * 1000;

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeState(state: State): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

/** Chains are validated on load: a malformed entry is dropped, not trusted. */
function loadChains(): Chains | undefined {
  const raw = readJson<Chains | undefined>(CHAINS_PATH, undefined);
  if (!raw || typeof raw !== "object") return undefined;

  const clean: Chains = {};
  for (const [role, list] of Object.entries(raw)) {
    if (Array.isArray(list) && list.every((item) => typeof item === "string")) {
      clean[role] = list.filter((item): item is string => item.length > 0);
    }
  }
  return Object.keys(clean).length ? clean : undefined;
}

function isCooling(state: State, model: string): boolean {
  const entry = state.models[model];
  return Boolean(entry && entry.until > Date.now());
}

/** Long cooldown for quota, short for a transient provider error. */
function cooldownFor(reason: string): number {
  const text = reason.toLowerCase();
  if (text.includes("quota") || text.includes("rate limit")) {
    return QUOTA_COOLDOWN_MS;
  }
  return TRANSIENT_COOLDOWN_MS;
}

function markFailure(state: State, model: string, reason: string): void {
  const previous = state.models[model];
  state.models[model] = {
    until: Date.now() + cooldownFor(reason),
    reason,
    failures: (previous?.failures ?? 0) + 1,
    updatedAt: Date.now(),
  };
  writeState(state);
}

/** First model in the role's chain that is not cooling. */
function pick(role: string, chains: Chains, state: State): string | undefined {
  return (chains[role] ?? []).find((model) => !isCooling(state, model));
}

export default function (pi: ExtensionAPI) {
  const state = readJson<State>(STATE_PATH, { models: {} });
  const chains = loadChains();

  pi.registerCommand("router-status", {
    description: "Show cooling models and the chains for each role",
    handler: async (_args, ctx) => {
      if (!chains) {
        ctx.ui.notify("No chains configured.", "warning");
        return;
      }
      const lines = Object.keys(chains).map((role) => {
        const chosen = pick(role, chains, state) ?? "(all cooling)";
        return `${role}: ${chosen}`;
      });
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("router-reset", {
    description: "Clear every cooldown",
    handler: async (_args, ctx) => {
      for (const key of Object.keys(state.models)) delete state.models[key];
      writeState(state);
      ctx.ui.notify("Cooldowns cleared.", "info");
    },
  });
}

export { cooldownFor, isCooling, loadChains, markFailure, pick };
