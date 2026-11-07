# MCP tool servers

MCP is how the harness reaches systems it was not written for. A server publishes
tools; the client discovers them at runtime. The harness never hardcodes the
integration, which means adding a capability is a config line rather than a code
change and a release.

## Discovery is three calls, not one

```
list      → names, one-line descriptions, and that is all
describe  → the full JSON schema for exactly one tool
call      → execute it
```

The order matters for the same reason skills do. Loading every schema up front
costs thousands of tokens to answer a question that may need one tool. Describing
on demand means the payload arrives when it is about to be used.

A harness that dumps its whole tool catalogue into every prompt is choosing to pay
that on every turn.

## Why MCP rather than a client library

| Hardcoded client | MCP server |
|---|---|
| one model provider, one language | any client that speaks the protocol |
| new integration = new code, new release | new integration = new server, no harness change |
| schema lives in the harness prompt | schema lives in the server, fetched when needed |
| auth is the app's problem again | auth handled per server |

The point is not portability for its own sake. It is that a tool definition
written once can be used by a different harness, a different model or a script,
and it keeps working when the harness is replaced.

## What I actually wire

Two shapes, both in daily use:

- **Local, over stdio.** A server that bridges a domain the model cannot touch
  directly: reverse-engineering tooling, binary analysis, file inspection. The
  model asks for a capability and gets a typed result rather than a hallucinated
  one.
- **Remote, over HTTP with auth.** A server fronting a live system where the
  credentials belong to the server and never enter the conversation. This is the
  important one: the model can act on a real system without the harness ever
  holding the secret inline.

## Config shape

Sanitised, credentials by environment reference only:

```json
{
  "mcpServers": {
    "domain-tools": {
      "type": "stdio",
      "command": "domain-mcp",
      "args": ["--workspace", "${WORKSPACE}"]
    },
    "live-system": {
      "type": "http",
      "url": "${SYSTEM_URL}",
      "headers": { "Authorization": "Bearer ${SYSTEM_TOKEN}" }
    }
  }
}
```

Two rules I hold to:

1. **Secrets come from the environment, never the file.** A config that can be
   committed is a config that survives being shared.
2. **One server, one system.** A server that fronts four systems has four failure
   modes and one error message.

## The failure mode worth naming

A tool server that returns a plausible wrong answer is worse than one that fails,
because the model will build on it. Every server here validates its own output
shape before returning, and a call that cannot be verified returns an error the
model can read rather than an empty success.
