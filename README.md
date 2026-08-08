# @oy-cli/opencode-cursor

Cursor SDK provider runtime for the OpenCode V2 integration shipped by
[`@oy-cli/opencode`](https://www.npmjs.com/package/@oy-cli/opencode).

This fork tracks
[`stablekernel/opencode-cursor`](https://github.com/stablekernel/opencode-cursor)
but intentionally supports only the provider boundary used by oy. It does not
export the upstream legacy OpenCode plugin, installer, model catalog, or
delegation tools.

> **Security:** Cursor executes its own shell, read, write, edit, delete, MCP,
> and subagent tools directly in the configured working directory. OpenCode's
> permission prompts do not mediate those calls. Use Cursor's `sandbox` option
> when that boundary is unsuitable.

## Runtime contract

- Node.js 22.13 or newer
- OpenCode V2 through `@oy-cli/opencode`
- Vercel AI SDK provider V3
- `@cursor/sdk` 1.0.27

The public package surface is the `createCursor()` provider factory. oy owns
OpenCode registration, model discovery, skills, system-boundary instructions,
and translation between AI SDK events and OpenCode V2's Responses stream.

Direct installation is intended for oy development:

```bash
npm install @oy-cli/opencode-cursor
```

Most users should install only `@oy-cli/opencode`.

`@cursor/sdk` currently resolves an older nested `undici` through Connect.
Because npm does not apply overrides declared by dependencies, applications
embedding this provider directly must enforce `undici` 6.28.0 from their root.
`@oy-cli/opencode` already does so.

## Reliability behavior

- A 120-second idle watchdog detects streams that stop producing SDK updates.
- Tool calls use a separate 10-minute budget to avoid killing healthy builds
  and tests.
- A pre-output stall is cancelled and force-sent once.
- Rate-limit and network send failures receive bounded retries.
- A terminal Cursor error before any downstream output triggers one fresh-agent
  full-transcript replay, for both resumed and newly created agents.
- Replays retain the turn idempotency key and failed agents are removed from the
  session pool.
- Silent queued-message replay uses the same watchdog and terminal-status path
  as visible turns.
- Terminal errors report Cursor's result detail and counts for every SDK update
  type received.

Environment controls:

| Variable | Default | Meaning |
| --- | ---: | --- |
| `OPENCODE_CURSOR_STALL_MS` | `120000` | Idle watchdog; `0` disables it |
| `OPENCODE_CURSOR_TOOL_STALL_MS` | `600000` | In-flight tool watchdog; `0` disables it |
| `OPENCODE_CURSOR_TRANSPORT` | runtime-dependent | `http1`, `http2-direct`, or `sidecar` |
| `OPENCODE_CURSOR_DEBUG` | off | Set to `1` for turn and retry diagnostics |

Under Bun, HTTP/1.1 is the default because Bun's HTTP/2 implementation is not
compatible with Cursor's streaming RPC. The Node sidecar remains available as a
rollback transport.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Upstream changes should be cherry-picked selectively. Provider, Cursor SDK,
transport, stream, and session-pool fixes are relevant; legacy plugin UI and
installer changes are not.

## License

MIT
