# log-integ-test fixture project

Minimal WinCC OA project used by integration tests.  
No SQLite databases are needed — tests run with WCCOActrl in standalone (`-n`) mode.

## Token placeholders in `config/config`

| Token | Description |
| --- | --- |
| `<WinCC_OA_PATH>` | WinCC OA install path (e.g. `/opt/WinCC_OA/3.21`) |
| `<PROJECT_PATH>` | Absolute path to this directory |
| `<WinCC_OA_VERSION>` | WinCC OA version string (e.g. `3.21`) |

The integration test helper patches these at runtime and restores them after each test run.
