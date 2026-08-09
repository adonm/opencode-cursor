# Contributing

Thanks for your interest in improving `@oy-cli/opencode-cursor`! Issues and pull
requests are welcome.

## Reporting issues

- **Bugs / features:** open an issue at
  <https://github.com/adonm/opencode-cursor/issues>.
- **Security vulnerabilities:** do **not** file a public issue — see
  [SECURITY.md](./SECURITY.md).

When reporting a runtime bug, please include:

- your runtime (Bun vs. Node) and version, and your opencode version,
- whether the Node sidecar is in use (Bun + `node` on `PATH`),
- output from running with `OPENCODE_CURSOR_DEBUG=1`.

## Development setup

Requires **Node.js 24.15+**.

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run --ignore-scripts
```

CI runs unit tests and builds on current Node 24 and 26 releases, verifies a
script-disabled package install, and runs an optional scheduled live Cursor
canary. The runtime depends on `@cursor/sdk` and peers with
`@ai-sdk/provider`; OpenCode registration belongs to `@oy-cli/opencode`.

## Pull requests

- Add or update tests for behavior changes (this repo uses
  [Vitest](https://vitest.dev); see `test/`).
- Keep `npm run typecheck`, `npm test`, and `npm run build` green.
- Update `CHANGELOG.md` under the appropriate version/`[Unreleased]` heading.

## Releasing (maintainers)

The `.github/workflows/release.yml` workflow publishes automatically when a
version tag is pushed:

```bash
# 1. Bump the version in package.json (patch / minor / major)
npm version patch          # or: minor, major, or e.g. --new-version 0.2.0

# 2. Push the commit and the generated tag together
git push origin main --follow-tags
```

The release job will:

1. Run `prepublishOnly` (typecheck → test → build) to gate the publish.
2. Verify the committed provider bundle can be imported.
3. Publish to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) and provenance.
4. Create a GitHub Release with the npm tarball and generated release notes.

The npm package must trust this repository's release workflow and `npm`
environment. `CURSOR_API_KEY` is optional and used only by the scheduled/manual
live canary.

For the package's one-time registry bootstrap, npm cannot use OIDC before the
package exists. From the exact release commit, authenticate interactively and
run `npm publish --access public`. Then configure npm's trusted publisher for
`adonm/opencode-cursor`, `.github/workflows/release.yml`, environment `npm`,
with `npm publish` allowed. Push the matching version tag only after that; the
idempotent workflow verifies the published `gitHead` and creates the GitHub
release without republishing.

**Pre-publish checklist:** update `CHANGELOG.md`, confirm `version` in
`package.json` matches the tag, and ensure the branch is merged to `main`.
