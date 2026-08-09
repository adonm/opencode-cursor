# Security Policy

## Supported versions

This project is pre-1.0. Security fixes are made against the latest published
version on npm and the `main` branch.

## Trust model

This package is a provider-only runtime used by `@oy-cli/opencode`. Cursor runs
its own agent loop and host tools, including shell, read, write, edit, delete,
MCP, and subagents. OpenCode permission prompts do not gate those internal
calls, and Cursor's sandbox is off by default.

An explicit absolute working directory is honored even when it is outside the
initial workspace. That behavior is intentional for normal multi-repository
work. Use an external container or VM when host filesystem isolation is
required. Cursor's `sandbox: true` option is available as convenience
hardening, but is not presented as a replacement for external isolation.

The authenticated loopback Responses bridge, model catalog, skills, and
OpenCode V2 registration are owned by `@oy-cli/opencode`, not this package.

## Credentials

- Your `CURSOR_API_KEY` is supplied by the embedding adapter or environment.
- The key is **never logged or written to disk** by this provider. Debug
  tracing (`OPENCODE_CURSOR_DEBUG=1`) does not print the key.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via GitHub's **[private vulnerability reporting](https://github.com/adonm/opencode-cursor/security/advisories/new)**
(Security → Report a vulnerability on the repository). Include a description, a
reproduction if possible, and the impact you've identified.

We aim to acknowledge reports within a few business days and will coordinate a
fix and disclosure timeline with you.
