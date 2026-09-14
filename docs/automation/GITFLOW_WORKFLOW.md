# Git Flow (this package)

Branching, releases, hotfixes, and PR guardrails are **org-standard**, not
package-specific. Prefer shared APM skills / template docs over a second long
copy of the template narrative.

## Source of truth

| Topic | Where |
| ----- | ----- |
| Workflows in this repo | `.github/workflows/` (`gitflow*.yml`, `create-release-branch.yml`, `pre-release*.yml`, `release*.yml`) |
| Rulesets / settings | `.github/rulesets/`, `.github/repository.settings.yml` |
| CI package notes | [CI-INTEGRATION.md](./CI-INTEGRATION.md) |

## Quick branch map

| Branch | Target PR base |
| ------ | -------------- |
| `feature/*`, `bugfix/*` | `develop` |
| `release/v*`, `hotfix/v*` | `main` (create via Actions → **Create Release Branch + PR**) |

Do **not** hand-create release/hotfix branches; use the workflow.

## Required status checks (typical)

- `CI/CD Pipeline - Required`
- `PR Labels - Required`
- `Git Flow Validation - Required`
