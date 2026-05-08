# Source Code

Note: Despite the folder name, this codebase currently contains the **PNL/XML converter template example**.

## Structure

- `converter.ts` — core `PnlXmlConverter` implementation (wraps `WCCOAui -xmlConvert`)
- `api.ts` — convenience functions (`pnlToXml`, `xmlToPnl`)
- `cli.ts` — CLI entrypoint (`winccoa-pnl-xml`)
- `types.ts` / `types/` — public types (`ConversionOptions`, `ConversionResult`, `ConversionDirection`)
- `utils/` — shared helpers

## Key behavior

- WinCC OA conversions are typically **in-place** and may create a `.bak` file.
- The `-p` input path is usually resolved relative to the project's `panels/` directory.
