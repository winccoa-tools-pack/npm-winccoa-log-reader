#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { readLogFile } from './api';
import type { LogEntry, LogFilterOptions, LogSeverity } from './types';

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_FAILED = 2;

const BIN = 'winccoa-log-reader';

export interface ParsedArgs {
    filePath: string;
    json: boolean;
    resultFile?: string;
    filter: LogFilterOptions;
}

export function printUsage(): void {
    process.stderr.write(
        [
            '',
            `Usage: ${BIN} [options] <logfile>`,
            '',
            'Read a classic WinCC OA log (e.g. PVSS_II.log) and emit JSON entries.',
            '',
            'Options:',
            '  --json                    Emit JSON (default)',
            '  --no-json                 Simple TSV: time, id, type, prio, text',
            '  --result-file <path>      Write payload to a file instead of stdout',
            '  --severity <list>        Include priorities (comma-separated)',
            '  --exclude-severity <list> Exclude priorities',
            '  --manager <list>          Include manager names',
            '  --exclude-manager <list>  Exclude manager names',
            '  --type <list>             Include error types (SYS, CTRL, …)',
            '  --exclude-type <list>     Exclude error types',
            '  --code <list>             Include error codes (numbers)',
            '  --exclude-code <list>     Exclude error codes',
            '  --catalog <list>          Include error catalogs',
            '  --text <list>             Include if errorText contains (substring)',
            '  --exclude-text <list>     Exclude if errorText contains',
            '  -h, --help                Show this help',
            '',
            'Examples:',
            `  ${BIN} path/to/PVSS_II.log`,
            `  ${BIN} PVSS_II.log --severity WARNING,FATAL --result-file out.json`,
            `  ${BIN} PVSS_II.log --manager WCCOActrl --text timeout --no-json`,
            '',
            'Library: import { readLogFile, parseLogContent } from the package.',
            '',
        ].join('\n'),
    );
}

function splitList(raw: string): string[] {
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function parseNumberList(raw: string): number[] | null {
    const parts = splitList(raw);
    const nums: number[] = [];
    for (const p of parts) {
        const n = Number.parseInt(p, 10);
        if (Number.isNaN(n)) return null;
        nums.push(n);
    }
    return nums;
}

function takeValue(
    args: string[],
    i: number,
    a: string,
    longName: string,
): { value: string; next: number } | { error: string } {
    let value: string | undefined;
    let next = i;
    if (a.startsWith(`${longName}=`)) {
        value = a.slice(longName.length + 1);
    } else {
        value = args[i + 1];
        if (value === undefined || value.startsWith('-')) {
            return { error: `${longName} requires a value.` };
        }
        next = i + 1;
    }
    if (!value || value.trim() === '') {
        return { error: `${longName} requires a non-empty value.` };
    }
    return { value, next };
}

/**
 * Parse CLI argv. Returns null for help / invalid usage.
 */
export function parseArgs(argv: string[]): ParsedArgs | null {
    const args = argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        return null;
    }

    let json = true;
    let resultFile: string | undefined;
    let filePath: string | undefined;
    const filter: LogFilterOptions = {};

    for (let i = 0; i < args.length; i++) {
        const a = args[i];

        if (a === '--json') {
            json = true;
        } else if (a === '--no-json') {
            json = false;
        } else if (a === '--result-file' || a.startsWith('--result-file=')) {
            const t = takeValue(args, i, a, '--result-file');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            resultFile = t.value;
            i = t.next;
        } else if (a === '--severity' || a.startsWith('--severity=')) {
            const t = takeValue(args, i, a, '--severity');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.includeErrorPriority = splitList(t.value) as LogSeverity[];
            i = t.next;
        } else if (a === '--exclude-severity' || a.startsWith('--exclude-severity=')) {
            const t = takeValue(args, i, a, '--exclude-severity');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.excludeErrorPriority = splitList(t.value) as LogSeverity[];
            i = t.next;
        } else if (a === '--manager' || a.startsWith('--manager=')) {
            const t = takeValue(args, i, a, '--manager');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.includeManagerName = splitList(t.value);
            i = t.next;
        } else if (a === '--exclude-manager' || a.startsWith('--exclude-manager=')) {
            const t = takeValue(args, i, a, '--exclude-manager');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.excludeManagerName = splitList(t.value);
            i = t.next;
        } else if (a === '--type' || a.startsWith('--type=')) {
            const t = takeValue(args, i, a, '--type');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.includeErrorType = splitList(t.value);
            i = t.next;
        } else if (a === '--exclude-type' || a.startsWith('--exclude-type=')) {
            const t = takeValue(args, i, a, '--exclude-type');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.excludeErrorType = splitList(t.value);
            i = t.next;
        } else if (a === '--code' || a.startsWith('--code=')) {
            const t = takeValue(args, i, a, '--code');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            const nums = parseNumberList(t.value);
            if (!nums) {
                process.stderr.write('Error: --code expects comma-separated integers.\n');
                return null;
            }
            filter.includeErrorCode = nums;
            i = t.next;
        } else if (a === '--exclude-code' || a.startsWith('--exclude-code=')) {
            const t = takeValue(args, i, a, '--exclude-code');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            const nums = parseNumberList(t.value);
            if (!nums) {
                process.stderr.write('Error: --exclude-code expects comma-separated integers.\n');
                return null;
            }
            filter.excludeErrorCode = nums;
            i = t.next;
        } else if (a === '--catalog' || a.startsWith('--catalog=')) {
            const t = takeValue(args, i, a, '--catalog');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.includeErrorCatalog = splitList(t.value);
            i = t.next;
        } else if (a === '--text' || a.startsWith('--text=')) {
            const t = takeValue(args, i, a, '--text');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.textContains = splitList(t.value);
            i = t.next;
        } else if (a === '--exclude-text' || a.startsWith('--exclude-text=')) {
            const t = takeValue(args, i, a, '--exclude-text');
            if ('error' in t) {
                process.stderr.write(`Error: ${t.error}\n`);
                return null;
            }
            filter.excludeErrorText = splitList(t.value);
            i = t.next;
        } else if (a === '-h' || a === '--help') {
            return null;
        } else if (a.startsWith('-')) {
            process.stderr.write(`Error: Unknown option "${a}".\n`);
            return null;
        } else if (filePath === undefined) {
            filePath = a;
        } else {
            process.stderr.write(`Error: Unexpected argument "${a}".\n`);
            return null;
        }
    }

    if (!filePath) {
        process.stderr.write('Error: Missing <logfile> path.\n');
        return null;
    }

    return { filePath, json, resultFile, filter };
}

function formatHuman(entries: LogEntry[]): string {
    if (entries.length === 0) {
        return 'No log entries matched.\n';
    }
    return (
        entries
            .map((e) => {
                const code =
                    e.errorCatalog && e.errorCode !== undefined
                        ? `${e.errorCode}/${e.errorCatalog}`
                        : e.errorCode !== undefined
                          ? String(e.errorCode)
                          : '';
                return [
                    e.timeStampString,
                    e.identifier,
                    e.errorType,
                    e.errorPriority,
                    code,
                    e.errorText.replace(/\t/g, ' '),
                ].join('\t');
            })
            .join('\n') + '\n'
    );
}

export function formatPayload(entries: LogEntry[], json: boolean): string {
    if (json) {
        return `${JSON.stringify(entries, null, 2)}\n`;
    }
    return formatHuman(entries);
}

export function emitResult(payload: string, resultFile?: string): void {
    if (!resultFile) {
        process.stdout.write(payload);
        return;
    }
    const resolved = path.resolve(resultFile);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, payload, 'utf8');
    process.stderr.write(`Wrote result to ${resolved}\n`);
}

export function main(argv: string[] = process.argv): number {
    const parsed = parseArgs(argv);
    if (!parsed) {
        printUsage();
        return EXIT_USAGE;
    }

    try {
        const entries = readLogFile({
            filePath: parsed.filePath,
            filter: parsed.filter,
        });
        const payload = formatPayload(entries, parsed.json);
        emitResult(payload, parsed.resultFile);
        return EXIT_OK;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
        return EXIT_FAILED;
    }
}

const isDirectRun =
    typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;

if (isDirectRun) {
    process.exitCode = main();
}
