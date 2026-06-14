# Publishing CraftDAG to npm

CraftDAG publishes public scoped packages under the `@i365dev` npm organization:

- `@i365dev/craftdag-core`
- `@i365dev/craftdag-exporter-schem`

## One-time npm setup

1. Create an npm account at `https://www.npmjs.com/signup`.
2. Create or join the npm organization `i365dev`.
3. Enable 2FA on the npm account that will publish packages.

Scoped packages are private by default on npm, so the first public publish must use `--access public`.

## First public publish

Run this once from a machine where you can complete browser login and 2FA:

```bash
cd CraftDAG
npm login
pnpm install
pnpm build
pnpm test
pnpm --filter @i365dev/craftdag-core publish --no-git-checks --access public
pnpm --filter @i365dev/craftdag-exporter-schem publish --no-git-checks --access public
```

After this succeeds, the packages should be visible at:

- `https://www.npmjs.com/package/@i365dev/craftdag-core`
- `https://www.npmjs.com/package/@i365dev/craftdag-exporter-schem`

## GitHub Actions publishing

The publish workflow runs on version tags like `v0.1.4`, or by manual `workflow_dispatch`.

Because npm Trusted Publishing is configured from each package's npm settings page, the first publish may need to happen manually before the Trusted Publisher UI is available.

Until Trusted Publishing is configured, create a GitHub repository secret:

- Name: `NPM_TOKEN`
- Value: a granular npm access token with publish permissions for `@i365dev/craftdag-core` and `@i365dev/craftdag-exporter-schem`

After the packages exist on npm, you can switch to Trusted Publishing in each package's npm settings:

- Provider: GitHub Actions
- Organization or user: `i365dev`
- Repository: `CraftDAG`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

Once Trusted Publishing works, the `NPM_TOKEN` secret can be removed from GitHub.
