# CI + integration (this package)

Full pipeline behavior is defined by the workflows under `.github/workflows/`,
not by a long narrative doc. This page keeps only **package-local** notes.

## Workflows (source of truth)

| Workflow | Role |
| -------- | ---- |
| `.github/workflows/ci-cd.yml` | Lint, format, unit tests, host integration (CLI + log fixtures) |
| Other `.github/workflows/*` | Git Flow, release, labels, settings (see [GITFLOW_WORKFLOW.md](./GITFLOW_WORKFLOW.md)) |

## Local / agent guidance

- Contributor notes: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- Product scope: [docs/VISION.md](../VISION.md)

## This package’s CI knobs

| Item | Value / notes |
| ---- | ------------- |
| Unit | `npm run test:unit` |
| Integration | `npm run test:integration` / `npm run ci:integration` |
| Fixtures | `test/fixtures/*.log` (classic PVSS_II samples) |
| WinCC OA Docker | **Not required** — pure file parse |

Integration runs on the GitHub-hosted runner (Node only). There is no
`test/fixtures/projects/runnable` project fixture and no `config.winccoaImage`.

## CLI in automation

```shell
node dist/cjs/cli.js path/to/PVSS_II.log --result-file out/logs.json
node dist/cjs/cli.js path/to/PVSS_II.log --severity WARNING,FATAL --manager WCCOActrl
```

Exit codes: `0` ok, `1` usage/help, `2` failure. See README.
