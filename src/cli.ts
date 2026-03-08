#!/usr/bin/env node
/**
 * CLI entry point for @winccoa-tools-pack/npm-winccoa-log.
 *
 * Commands:
 *   winccoa-log read  <file> [options]   Read + filter a log file (JSON output)
 *   winccoa-log tail  <file> [options]   Stream new events as NDJSON
 *   winccoa-log help                     Show help
 */

import { readLog } from './reader.js';
import { LogWatcher } from './watcher.js';
import type { LogReadOptions, LogSeverity, LogWatcherOptions } from './types.js';

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_ERROR = 2;

// ── Argument parsing ─────────────────────────────────────────────────────────

interface CommonArgs {
    filePath: string;
    filterSeverity?: LogSeverity[];
    filterScope?: string[];
    pretty: boolean;
}

interface ReadArgs extends CommonArgs {
    sinceTimestamp?: string;
    lastN?: number;
}

function printUsage(): void {
    process.stderr.write(
        [
            '',
            'Usage: winccoa-log <command> [options]',
            '',
            'Commands:',
            '  read  <file>   Read + filter a log file, print JSON to stdout',
            '  tail  <file>   Watch a log file, stream NDJSON to stdout',
            '  help           Show this help',
            '',
            'Options:',
            '  --severity <level,...>   Comma-separated severities to include',
            '                           (INFO,WARNING,FATAL,SEVERE,DEBUG,OTHER)',
            '  --scope <scope,...>      Comma-separated scopes (e.g. SYS,CTRL)',
            '  --since <timestamp>      Only events >= timestamp (YYYY.MM.DD HH:mm:ss.SSS)',
            '  --last-n <n>             Return last N events only  (read only)',
            '  --pretty                 Pretty-print JSON output',
            '',
            'Examples:',
            '  winccoa-log read  /opt/winccoa/log/PVSS_II.log --severity WARNING,FATAL',
            '  winccoa-log read  /opt/winccoa/log/PVSS_II.log --last-n 50 --pretty',
            '  winccoa-log tail  /opt/winccoa/log/PVSS_II.log --severity FATAL,SEVERE',
            '',
        ].join('\n'),
    );
}

function parseSeverities(raw: string): LogSeverity[] {
    const valid: LogSeverity[] = ['INFO', 'WARNING', 'FATAL', 'SEVERE', 'DEBUG', 'OTHER'];
    return raw
        .split(',')
        .map((s) => s.trim().toUpperCase() as LogSeverity)
        .filter((s) => valid.includes(s));
}

function parseCommonArgs(argv: string[]): CommonArgs | null {
    if (argv.length < 1) {
        process.stderr.write('Error: file path is required\n');
        return null;
    }

    const args: CommonArgs = { filePath: argv[0], pretty: false };
    let i = 1;

    while (i < argv.length) {
        switch (argv[i]) {
            case '--severity':
                args.filterSeverity = parseSeverities(argv[++i] ?? '');
                break;
            case '--scope':
                args.filterScope = (argv[++i] ?? '').split(',').map((s) => s.trim());
                break;
            case '--pretty':
                args.pretty = true;
                break;
            default:
                process.stderr.write(`Warning: unknown option ${argv[i]}\n`);
        }
        i++;
    }

    return args;
}

function parseReadArgs(argv: string[]): ReadArgs | null {
    if (argv.length < 1) {
        process.stderr.write('Error: file path is required\n');
        return null;
    }

    const args: ReadArgs = { filePath: argv[0], pretty: false };
    let i = 1;

    while (i < argv.length) {
        switch (argv[i]) {
            case '--severity':
                args.filterSeverity = parseSeverities(argv[++i] ?? '');
                break;
            case '--scope':
                args.filterScope = (argv[++i] ?? '').split(',').map((s) => s.trim());
                break;
            case '--since':
                args.sinceTimestamp = argv[++i];
                break;
            case '--last-n': {
                const n = parseInt(argv[++i] ?? '0', 10);
                if (!isNaN(n) && n > 0) args.lastN = n;
                break;
            }
            case '--pretty':
                args.pretty = true;
                break;
            default:
                process.stderr.write(`Warning: unknown option ${argv[i]}\n`);
        }
        i++;
    }

    return args;
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdRead(argv: string[]): number {
    const args = parseReadArgs(argv);
    if (!args) return EXIT_USAGE;

    const opts: LogReadOptions = {
        filterSeverity: args.filterSeverity,
        filterScope: args.filterScope,
        sinceTimestamp: args.sinceTimestamp,
        lastN: args.lastN,
    };

    let result;
    try {
        result = readLog(args.filePath, opts);
    } catch (err: unknown) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        return EXIT_ERROR;
    }

    const json = args.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);

    process.stdout.write(json + '\n');
    return EXIT_OK;
}

function cmdTail(argv: string[]): number {
    const args = parseCommonArgs(argv);
    if (!args) return EXIT_USAGE;

    const opts: LogWatcherOptions = {
        files: [args.filePath],
        filterSeverity: args.filterSeverity,
        filterScope: args.filterScope,
    };

    const watcher = new LogWatcher(opts);

    watcher.on('event', (event) => {
        const json = args.pretty ? JSON.stringify(event, null, 2) : JSON.stringify(event);
        process.stdout.write(json + '\n');
    });

    watcher.on('error', (err: Error) => {
        process.stderr.write(`Watcher error: ${err.message}\n`);
    });

    watcher.start();

    // Keep alive — Ctrl-C or SIGTERM to exit
    process.on('SIGINT', () => {
        watcher.stop();
        process.exit(EXIT_OK);
    });

    process.on('SIGTERM', () => {
        watcher.stop();
        process.exit(EXIT_OK);
    });

    return EXIT_OK; // process stays alive via watcher
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [, , command = '', ...rest] = process.argv;

switch (command) {
    case 'read':
        process.exit(cmdRead(rest));
        break;
    case 'tail': {
        const code = cmdTail(rest);
        if (code !== EXIT_OK) process.exit(code);
        // else: keep process alive — watcher holds the event loop
        break;
    }
    case 'help':
    case '--help':
    case '-h':
        printUsage();
        process.exit(EXIT_OK);
        break;
    default:
        if (command) {
            process.stderr.write(`Unknown command: ${command}\n`);
        }
        printUsage();
        process.exit(EXIT_USAGE);
}
