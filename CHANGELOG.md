# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Classic `PVSS_II.log` parser (`LogParser`, `parseLogContent`) aligned with CTRL oaLogs / logviewer
- Include/exclude filters (`filterEntries`, `matchesFilter`)
- Library API `readLogFile` / `readLogText`
- CLI `winccoa-log-reader` with JSON default, filters, and `--result-file`
- Unit and integration tests with sample classic log fixture

## [0.1.0] - TBD

Initial release of `@winccoa-tools-pack/npm-winccoa-log-reader` (renamed from shared library template).
