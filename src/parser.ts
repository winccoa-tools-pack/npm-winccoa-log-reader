import type { LogEntry, LogMetadata, LogSeverity } from './types';

/**
 * Streaming parser for classic WinCC OA PVSS_II.log lines.
 *
 * Main line format (CTRL LogParserClassic / vscode-winccoa-logviewer):
 *   managerName (managerNum), YYYY.MM.DD HH:mm:ss.SSS, TYPE, PRIO, code[/catalog], text
 *
 * Continuation lines may carry Script / Library / Line / Stacktrace metadata.
 */
export class LogParser {
    private buffer: string[] = [];
    private current: Partial<LogEntry> | null = null;
    private stacktraceMode = false;
    private sourceFile?: string;

    constructor(options?: { sourceFile?: string }) {
        this.sourceFile = options?.sourceFile;
    }

    /** Parse one line; returns events completed by starting a new main line. */
    public parseLine(line: string): LogEntry[] {
        const completed: LogEntry[] = [];
        const main = this.parseMainLine(line);

        if (main) {
            if (this.current) {
                const done = this.finalize();
                if (done) completed.push(done);
            }
            this.current = main;
            this.buffer = [line];
            this.stacktraceMode = false;
        } else if (this.current) {
            this.buffer.push(line);
            this.parseMetadataLine(line);
        }

        return completed;
    }

    /** Finalize any buffered event. */
    public flush(): LogEntry | null {
        if (this.current) {
            return this.finalize();
        }
        return null;
    }

    private parseMainLine(line: string): Partial<LogEntry> | null {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null;

        // IDENTIFIER + optional spaces + (NUM), TIMESTAMP, SCOPE, SEVERITY, rest
        const regex =
            /^(\w+)\s*\((\d+)\),\s+(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}),\s*(\w+),\s*(\w+),\s+(.+)$/;
        const match = trimmedLine.match(regex);
        if (!match) return null;

        const [, managerName, managerNumStr, timestamp, errorType, severity, rest] = match;
        const restMatch = rest.match(/^\s*(\d+(?:\/\w+)?),\s*(.*)$/);
        if (!restMatch) return null;

        const [, codePart, message] = restMatch;
        let errorCode: number | undefined;
        let errorCatalog: string | undefined;
        const slash = codePart.indexOf('/');
        if (slash > 0) {
            errorCode = Number.parseInt(codePart.slice(0, slash), 10);
            errorCatalog = codePart.slice(slash + 1);
        } else {
            errorCode = Number.parseInt(codePart, 10);
            if (Number.isNaN(errorCode)) errorCode = undefined;
        }

        const num = Number.parseInt(managerNumStr, 10);
        const name = managerName.trim();

        return {
            managerName: name,
            managerNum: num,
            identifier: `${name}(${num})`,
            timeStampString: timestamp.trim(),
            errorType: errorType.trim(),
            errorPriority: normalizeSeverity(severity.trim()),
            errorCode,
            errorCatalog,
            errorText: message.trim(),
            metadata: {},
            rawLines: [],
            sourceFile: this.sourceFile,
        };
    }

    private parseMetadataLine(line: string): void {
        if (!this.current) return;
        if (!this.current.metadata) this.current.metadata = {};

        const meta = this.current.metadata;
        const trimmed = line.trim();

        // CTRL / oaUnit variants: "Stacktrace:" or "StackTrace:"
        if (/^stacktrace:$/i.test(trimmed)) {
            this.stacktraceMode = true;
            meta.stacktrace = [];
            return;
        }

        if (this.stacktraceMode) {
            // Numbered: "0: main at scripts/demo.ctl:12"
            const numbered = trimmed.match(/^(\d+):\s+(.+?)\s+at\s+(.+):(\d+)\s*$/);
            if (numbered && meta.stacktrace) {
                const [, index, functionName, filePath, lineNo] = numbered;
                meta.stacktrace.push({
                    index: Number.parseInt(index, 10),
                    functionName: functionName.trim(),
                    filePath: filePath.trim(),
                    line: Number.parseInt(lineNo, 10),
                });
                return;
            }

            // Unnumbered CTRL frames:
            // "void Foo::bar() at path/file.ctl:68"
            const unnumbered = trimmed.match(/^(.+?)\s+at\s+(.+):(\d+)\s*$/);
            if (unnumbered && meta.stacktrace) {
                const [, functionName, filePath, lineNo] = unnumbered;
                meta.stacktrace.push({
                    index: meta.stacktrace.length,
                    functionName: functionName.trim(),
                    filePath: filePath.trim(),
                    line: Number.parseInt(lineNo, 10),
                });
                return;
            }

            // Keep non-frame lines under stacktrace as raw; stay in mode until next main line
            if (trimmed.length > 0) {
                if (!meta.raw) {
                    meta.raw = trimmed;
                } else {
                    meta.raw += `\n${trimmed}`;
                }
            }
            return;
        }

        // Inline syntax-error location on the main message:
        // "Syntax error, 'vp' unexpected, expected ';', /path/file.ctl,   Line: 134"
        if (
            this.current.errorText &&
            this.current.errorText.toLowerCase().includes('syntax error')
        ) {
            const syntaxMatch = this.current.errorText.match(
                /^(.+?),\s*(.+?),\s*([^,]+),\s*Line:\s*(\d+)/,
            );
            if (syntaxMatch) {
                const [, errorType, errorDetail, filePath, lineNo] = syntaxMatch;
                this.current.errorText = `${errorType.trim()}, ${errorDetail.trim()}`;
                meta.library = filePath.trim();
                meta.line = Number.parseInt(lineNo, 10);
                // Continuation source snippet still goes to raw below
            }
        }

        if (trimmed.startsWith('Script:')) {
            meta.script = trimmed.substring(7).trim();
            return;
        }

        if (trimmed.startsWith('Library:')) {
            meta.library = trimmed.substring(8).trim();
            return;
        }

        if (trimmed.startsWith('Line:')) {
            const lineContent = trimmed.substring(5).trim();
            const lineMatch = lineContent.match(/^(\d+)/);
            if (lineMatch) {
                meta.line = Number.parseInt(lineMatch[1], 10);
            }
            return;
        }

        const commaLine = trimmed.match(/^,\s*Line\s+(\d+)/i);
        if (commaLine) {
            if (meta.script) {
                meta.library = meta.script;
                meta.line = Number.parseInt(commaLine[1], 10);
                meta.script = undefined;
            }
            return;
        }

        // CTRL stack frames sometimes appear without a Stacktrace: header
        const bareFrame = trimmed.match(/^(.+?)\s+at\s+(.+):(\d+)\s*$/);
        if (bareFrame) {
            if (!meta.stacktrace) meta.stacktrace = [];
            const [, functionName, filePath, lineNo] = bareFrame;
            meta.stacktrace.push({
                index: meta.stacktrace.length,
                functionName: functionName.trim(),
                filePath: filePath.trim(),
                line: Number.parseInt(lineNo, 10),
            });
            return;
        }

        if (
            trimmed.length > 0 &&
            !trimmed.startsWith('Script:') &&
            !trimmed.startsWith('Library:') &&
            !trimmed.startsWith('Line:')
        ) {
            if (!meta.raw) {
                meta.raw = trimmed;
            } else {
                meta.raw += `\n${trimmed}`;
            }
        }
    }

    private finalize(): LogEntry | null {
        if (!this.current || this.current.managerName === undefined) {
            this.current = null;
            this.buffer = [];
            this.stacktraceMode = false;
            return null;
        }

        const meta = this.current.metadata;
        const hasMeta =
            meta &&
            Object.keys(meta).some((k) => {
                const v = meta[k as keyof LogMetadata];
                return v !== undefined && !(Array.isArray(v) && v.length === 0);
            });

        const entry: LogEntry = {
            managerName: this.current.managerName,
            managerNum: this.current.managerNum ?? 0,
            identifier:
                this.current.identifier ??
                `${this.current.managerName}(${this.current.managerNum ?? 0})`,
            timeStampString: this.current.timeStampString ?? '',
            errorType: this.current.errorType ?? 'UNKNOWN',
            errorPriority: this.current.errorPriority ?? 'OTHER',
            errorCode: this.current.errorCode,
            errorCatalog: this.current.errorCatalog,
            errorText: this.current.errorText ?? '',
            metadata: hasMeta ? (meta as LogMetadata) : undefined,
            rawLines: [...this.buffer],
            sourceFile: this.current.sourceFile ?? this.sourceFile,
        };

        this.current = null;
        this.buffer = [];
        this.stacktraceMode = false;
        return entry;
    }
}

/** Normalize priority strings; ERROR → FATAL (logviewer convention). */
export function normalizeSeverity(severity: string): LogSeverity {
    const upper = severity.toUpperCase();
    switch (upper) {
        case 'INFO':
            return 'INFO';
        case 'WARNING':
            return 'WARNING';
        case 'ERROR':
        case 'FATAL':
            return 'FATAL';
        case 'SEVERE':
            return 'SEVERE';
        case 'DEBUG':
            return 'DEBUG';
        default:
            return 'OTHER';
    }
}

/** Parse an entire classic log file content string. */
export function parseLogContent(content: string, sourceFile?: string): LogEntry[] {
    const parser = new LogParser({ sourceFile });
    const lines = content.split(/\r?\n/);
    const events: LogEntry[] = [];

    for (const line of lines) {
        events.push(...parser.parseLine(line));
    }

    const last = parser.flush();
    if (last) events.push(last);

    return events;
}
