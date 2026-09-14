# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-14

### Added

- classic PVSS_II.log reader CLI and library (#58)

### Fixed

- restore valid pre-release.yml (remove BOM/corruption) (#60)

### Changed

- bump actions/github-script from 8 to 9 (#20)
- bump actions/upload-artifact from 6 to 7 (#1)
- add missing template workflows (auto-approve, rebase-open-prs) (#61)
- bump softprops/action-gh-release from 2 to 3 (#19)
- deps-dev(deps-dev): bump smol-toml from 1.7.0 to 1.7.2 (#57)
- deps-dev(deps-dev): bump @humanfs/node from 0.16.7 to 0.16.8 (#56)
- bump brace-expansion (#55)
- bump actions/labeler from 6 to 7 (#54)
- bump js-yaml and markdownlint-cli (#53)
- deps-dev(deps-dev): bump linkify-it from 5.0.1 to 5.0.2 (#52)
- bump actions/setup-node from 6 to 7 (#51)
- deps-dev(deps-dev): bump globals from 17.4.0 to 17.7.0 (#49)
- deps-dev(deps-dev): bump markdownlint from 0.40.0 to 0.41.0 (#48)
- bump actions/checkout from 6 to 7 (#47)
- bump markdown-it and markdownlint-cli (#46)
- deps-dev(deps-dev): bump esbuild from 0.28.0 to 0.28.1 (#45)
- deps-dev(deps-dev): bump brace-expansion from 5.0.4 to 5.0.6 (#44)
- deps-dev(deps-dev): bump tsx from 4.21.0 to 4.22.1 (#43)
- deps-dev(deps-dev): bump eslint from 9.39.3 to 10.3.0 (#34)
- deps-dev(deps-dev): bump @types/node (#3)
- bump picomatch from 4.0.3 to 4.0.4 (#15)
- deps-dev(deps-dev): bump flatted from 3.3.3 to 3.4.2 (#12)
- deps-dev(deps-dev): bump typescript-eslint from 8.56.1 to 8.57.2 (#17)
- deps-dev(deps-dev): bump globals from 17.3.0 to 17.4.0 (#6)
- deps-dev(deps-dev): bump @eslint/js from 9.39.3 to 10.0.1 (#4)
- bump smol-toml and markdownlint-cli (#31)

## [Unreleased]

### Added

- Classic `PVSS_II.log` parser (`LogParser`, `parseLogContent`) aligned with CTRL oaLogs / logviewer
- Include/exclude filters (`filterEntries`, `matchesFilter`)
- Library API `readLogFile` / `readLogText`
- CLI `winccoa-log-reader` with JSON default, filters, and `--result-file`
- Unit and integration tests with sample classic log fixture

## [0.1.0] - TBD

Initial release of `@winccoa-tools-pack/npm-winccoa-log-reader` (renamed from shared library template).
