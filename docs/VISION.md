# Vision — npm-winccoa-log-reader

## Why this exists

WinCC OA writes classic text logs (`PVSS_II.log` and similar manager stderr-style
streams). Tools need a **shared, tested parser** that turns those lines into
stable JSON — for CLI grepping, CI checks, and extensions such as
`vscode-winccoa-logviewer`.

The authoritative in-product model is CTRL `classes/oaLogs`
(`LogParserClassic`, `LogEntry`, `LogFilter`, `LogReader`). This package ports
the classic line format and filter semantics to TypeScript for Node tooling.

## Vision statement

Be the small, boring log-read foundation for the tools pack: parse classic
logs correctly, filter like CTRL `matchByMap`, emit JSON by default, and stay
install-free (file I/O only).

## In scope

- Classic main-line parse:
  `managerName (num), YYYY.MM.DD HH:mm:ss.SSS, TYPE, PRIO, code[/catalog], text`
- Continuation metadata: `Script` / `Library` / `Line` / `Stacktrace`
- Severity normalize (`ERROR` → `FATAL`)
- Include/exclude filters on manager, type, priority, code, catalog, text
- CLI `winccoa-log-reader` with JSON default, TSV `--no-json`, `--result-file`
- Library exports: `readLogFile`, `readLogText`, `parseLogContent`, `LogParser`,
  `filterEntries`

## Example entry (illustrative)

```json
{
  "managerName": "WCCOActrl",
  "managerNum": 2,
  "identifier": "WCCOActrl(2)",
  "timeStampString": "2026.03.20 10:15:31.456",
  "errorType": "CTRL",
  "errorPriority": "WARNING",
  "errorCode": 42,
  "errorCatalog": "ctrl",
  "errorText": "Connection slow",
  "metadata": {
    "script": "scripts/demo.ctl",
    "library": "libs/helpers.ctl",
    "line": 88
  },
  "rawLines": ["..."],
  "sourceFile": "PVSS_II.log"
}
```

## Out of scope (for 0.1)

- Live tail / project path resolution (may come later or stay in logviewer)
- Non-classic / binary log formats
- Depending on `npm-winccoa-core` for pure file parse
- Replacing the VS Code logviewer UI

<center>Made with ❤️ for and by the WinCC OA community</center>
