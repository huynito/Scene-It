# Playwright Visual Workflow

This repo uses Playwright visual regression tests for stable UI surfaces such as:

- the landing screen
- theme chrome across supported themes

## Commands

Use the standard scripts from `package.json`:

```bash
npm test
npm run test:update
npm run test:ui
npm run test:report
```

## Multi-branch workflow

If you are running several theme branches or worktrees at the same time, give each one
its own test port:

```bash
TEST_PORT=3101 npm test
TEST_PORT=3102 npm test
TEST_PORT=3103 npm run test:update
```

The Playwright config reads `TEST_PORT` and defaults to `3100` when it is not set.

## Browser binaries

The npm scripts use `PLAYWRIGHT_BROWSERS_PATH=0`, which keeps the browser install local
to the repo's `node_modules/playwright-core/.local-browsers` path. This avoids
machine-global browser path confusion across multiple concurrent Cursor windows.

If browsers need to be reinstalled:

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
```

## Suggested operating pattern

- Use snapshot tests as the default validation path.
- Use interactive browser/MCP checks only when a visual issue needs manual inspection.
- Keep only one Cursor window actively driving browser automation at a time.

## Infra-only files to transfer to `master`

These are the repo-side files that should land on `master` and then flow back to feature
branches via merge or rebase:

- `.gitignore`
- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `tests/visual/helpers.ts`
- `tests/visual/landing.spec.ts`
- `tests/visual/themes.spec.ts`
- `tests/visual/README.md`
- `tests/__snapshots__/`

There is also one small app fix required for the suite to boot successfully in this
branch:

- `components/viewer/GraphEditor.tsx`
