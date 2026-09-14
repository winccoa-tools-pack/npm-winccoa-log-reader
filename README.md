# npm-winccoa-log-reader

<!-- markdownlint-disable MD033 -->
<div align="center">

[![npm version](https://img.shields.io/npm/v/@winccoa-tools-pack/npm-winccoa-log-reader.svg?label=npm)](https://www.npmjs.com/package/@winccoa-tools-pack/npm-winccoa-log-reader)
![License](https://img.shields.io/github/license/winccoa-tools-pack/npm-winccoa-log-reader)
[![CI/CD](https://github.com/winccoa-tools-pack/npm-winccoa-log-reader/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/winccoa-tools-pack/npm-winccoa-log-reader/actions/workflows/ci-cd.yml)
[![Release](https://github.com/winccoa-tools-pack/npm-winccoa-log-reader/actions/workflows/release.yml/badge.svg)](https://github.com/winccoa-tools-pack/npm-winccoa-log-reader/actions/workflows/release.yml)

</div>

CLI and library to **parse classic WinCC OA logs** (for example `PVSS_II.log`)
into structured **JSON**.

Aligned with CTRL `classes/oaLogs` (`LogParserClassic` / `LogEntry`) and the
parser used by `vscode-winccoa-logviewer`. Pure file parse — no WinCC OA
installation required.

See [docs/VISION.md](docs/VISION.md) for scope and field shapes.

## 📦 Installation

```shell
npm install -g @winccoa-tools-pack/npm-winccoa-log-reader
```

Or run without a global install:

```shell
npx @winccoa-tools-pack/npm-winccoa-log-reader --help
```

## CLI

```text
winccoa-log-reader [options] <logfile>
```

JSON is the default (best for scripts/CI). Use `--no-json` for a simple TSV
table. Prefer `--result-file` when you need a clean payload file.

### Options

| Option | Meaning |
| --- | --- |
| `--json` / `--no-json` | JSON (default) or TSV |
| `--result-file <path>` | Write payload to a file |
| `--severity <list>` | Include priorities (comma-separated) |
| `--exclude-severity <list>` | Exclude priorities |
| `--manager <list>` | Include manager names |
| `--exclude-manager <list>` | Exclude manager names |
| `--type <list>` | Include error types (`SYS`, `CTRL`, …) |
| `--exclude-type <list>` | Exclude error types |
| `--code <list>` | Include error codes |
| `--exclude-code <list>` | Exclude error codes |
| `--catalog <list>` | Include error catalogs |
| `--text <list>` | Include if `errorText` contains substring |
| `--exclude-text <list>` | Exclude if `errorText` contains substring |

Priorities are normalized: `ERROR` → `FATAL` (logviewer convention).

### Examples

```shell
winccoa-log-reader path/to/PVSS_II.log
winccoa-log-reader PVSS_II.log --severity WARNING,FATAL --result-file out.json
winccoa-log-reader PVSS_II.log --manager WCCOActrl --text timeout --no-json
```

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Usage / help |
| 2 | Runtime failure |

## Library

```ts
import {
  readLogFile,
  parseLogContent,
  filterEntries,
} from '@winccoa-tools-pack/npm-winccoa-log-reader';

const entries = readLogFile({
  filePath: 'logs/PVSS_II.log',
  filter: { includeErrorPriority: ['WARNING', 'FATAL'] },
});
```

More details: see [docs/USAGE.md](docs/USAGE.md).

## 🩺 Troubleshooting

- Non-zero exit code: inspect `stderr` and ensure `--version` matches your WinCC OA installation.
- Timeouts on large panels: increase `--timeout` / `timeout`.
- File not found: remember `inputPath` is usually relative to `panels/` in the active project context.

## 📚 Ecosystem Integration

This package is designed for seamless use with:

- **VS Code extensions for WinCC OA development**  
  Our open source community provides multiple VS Code tools that enhance the engineering workflow
  for WinCC OA developers. This converter acts as a foundation for UI-related features such as the Panel Explorer.

- **Node.js libraries**  
  Works side-by-side with other libraries in the winccoa-tools-pack suite (project management, core utilities, testing, etc.).

- **CI/CD automation**  
  Ideal for pipelines needing validation or transformation of UI panel resources.

- **Automation tokens** are recommended for CI/CD (they don't expire but can be revoked)
- The token needs **publish** permission for your package scope
- For scoped packages (`@winccoa-tools-pack/...`), ensure your NPM organization allows publishing

### Testing Without NPM_TOKEN

If `NPM_TOKEN` is not configured, the workflow will:

- ✅ Still run tests and build the package
- ✅ Create GitHub releases with artifacts
- ⚠️ Skip NPM publishing with a warning message

You can always publish manually later:

```bash
npm publish --access public
```

## 📦 Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 🏆 Recognition

Special thanks to all our [contributors](https://github.com/orgs/winccoa-tools-pack/people) who make this project possible!

### Key Contributors

- **Martin Pokorny** ([@mPokornyETM](https://github.com/mPokornyETM)) - Creator & Lead Developer
- And many more amazing contributors!

---

## 📜 License

This project is basically licensed under the **MIT License** - see the [LICENSE](https://github.com/winccoa-tools-pack/.github/blob/main/LICENSE) file for details.

It might happen that partial repositories contain third party SW which uses other license models.

---

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG.
This project is not affiliated with, endorsed by, or sponsored by Siemens AG.
This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

## 🎉 Thank You

Thank you for using WinCC OA tools package! We're excited to be part of your development journey.

Happy Coding! 🚀

---

## Quick Links

---

<center>Made with ❤️ for and by the WinCC OA community</center>
