# Development

- After completing sizable work, run `mise run ci:fix` to auto-fix lint/format issues and validate everything passes.

## Testing tiers

- **Unit tests** (vitest) — `mise run test`. Co-located with source as `*.test.ts`. Runs in CI (`mise run ci`). Use for pure logic.
- **Integration tests** (`@vscode/test-electron`) — `mise run test:integration`. Live under `src/test/integration/**/*.test.ts`. Runs in a real VS Code instance with the `empty-workspace` fixture by default. Requires a display (use `xvfb-run` on Linux). Runs in CI via the separate `integration` job. Use for event plumbing, command registration, and vscode-API-coupled behavior.
