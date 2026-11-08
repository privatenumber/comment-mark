# Packaging and runtime contracts

comment-mark ships one ESM implementation and declaration for the root entry. CommonJS consumers use Node's synchronous `require(esm)` interoperability rather than a separate CommonJS build. This avoids maintaining two bundles and declaration sets, but the reachable ESM graph must remain synchronous. The following was checked against `d41c4a5` on 2026-11-08.

## ESM and CommonJS interoperability

[PR #28](https://github.com/privatenumber/comment-mark/pull/28) replaced separate ESM and CommonJS outputs with `dist/index.mjs` and `dist/index.d.mts`. [Node 22.12.0](https://nodejs.org/en/blog/release/v22.12.0) unflagged `require(esm)`. Its [module documentation](https://nodejs.org/docs/v22.12.0/api/modules.html#loading-ecmascript-modules-using-require) requires the ESM graph to have no top-level `await`. The promise returned by `commentMark()` does not itself add top-level await to the module graph.

[Package-entry tests](../../tests/specs/package-entry.ts) load the built package from a consumer fixture using both `import` and `require`. Keep both tests when changing exports, dependencies, or build settings. TypeScript 5.8 documents `--module nodenext` support for `require(esm)` in its [release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html#support-for-require-of-ecmascript-modules-in---module-nodenext). CommonJS TypeScript consumers need a mode that models this interoperation. Re-evaluate if supported Node or TypeScript versions change.

The [package manifest](../../package.json) declares the root and files-plugin exports and publishes `dist` and `skills`. The README's claim that separate ESM and CommonJS builds ship is stale ([README](../../README.md)); the package description, `Interpolate strings with HTML comment markers`, also understates the reader and Markdown use case.

## Node version and CLI test boundary

The package declares Node `>=22.22.2` and builds with `--target=node22.22.2` ([manifest](../../package.json)). The development runtime is separately pinned to `v26.13.0` in [`.nvmrc`](../../.nvmrc). CI's oldest-version step uses `22.23.2`, not the exact declared minimum. Node 22 cannot parse the suite's `await using` syntax, so that step runs the tests through `tsx` against the built package ([workflow](../../.github/workflows/test.yml), [PR #20](https://github.com/privatenumber/comment-mark/pull/20)). This leaves a coverage gap at the precise floor; testing that version or changing the declared floor would close it.

CLI integration tests spawn `dist/cli.mjs` using the parent runtime's `process.execPath` ([helper](../../tests/utils/comment-mark-cli.ts)). This checks the built CLI on the selected Node version, but `pnpm dev` still uses the built CLI, so stale `dist` can hide source failures.

The source CLI currently imports named exports from JSON. On Node `v26.13.0`, after building at `d41c4a5`, these commands produced different results:

```sh
fnm exec --using=26.13.0 node src/cli.ts --version
fnm exec --using=26.13.0 node dist/cli.mjs --version
```

The first exited 1 with `SyntaxError: The requested module '../package.json' does not provide an export named 'description'`. The built CLI exited 0 and printed `0.0.0-semantic-release`. A source-CLI smoke test would cover a different boundary from the existing built-package test.

## Agent skills and releases

[PR #34](https://github.com/privatenumber/comment-mark/pull/34) replaced the `skills-npm` prepare step with pnpm's native dependency-skill linking, avoiding two tools managing the same links. The project pins pnpm 12.15.0, approves selected dependency skills, and configures `.agents/skills` in [pnpm-workspace.yaml](../../pnpm-workspace.yaml). [pnpm's agent-skills documentation](https://pnpm.io/agent-skills) describes approvals and target directories. The project still publishes its own `skills/comment-mark`; dependency skill linking and package publication are separate concerns. The PR recorded `ERR_PNPM_NO_AGENT_SKILLS_DIR` without an explicit directory in its tested setup; pnpm's current documentation describes no-directory behavior differently, so re-test before relying on that historical error.

The [release workflow](../../.github/workflows/release.yml) runs on pushes to `master`, `next`, `next-major`, `beta`, and `alpha`. It uses mutable action tags while granting repository, issue, pull-request, and OIDC write permissions. Pinning reviewed action commits and reviewing the permission scope are possible hardening steps; the configuration alone is not evidence of a compromise.
