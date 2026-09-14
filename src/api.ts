import fs from 'node:fs';
import path from 'node:path';

import { filterEntries } from './filter';
import { parseLogContent } from './parser';
import type { LogEntry, LogFilterOptions, ReadLogOptions } from './types';

export { LogParser, parseLogContent, normalizeSeverity } from './parser';
export { filterEntries, matchesFilter } from './filter';

/**
 * Read a classic WinCC OA log file and return parsed entries (optionally filtered).
 */
export function readLogFile(options: ReadLogOptions): LogEntry[] {
    const encoding = options.encoding ?? 'utf8';
    const resolved = path.resolve(options.filePath);
    const content = fs.readFileSync(resolved, { encoding });
    const sourceFile = path.basename(resolved);
    const entries = parseLogContent(content, sourceFile);
    return filterEntries(entries, options.filter);
}

/**
 * Parse log text already in memory.
 */
export function readLogText(
    content: string,
    filter?: LogFilterOptions,
    sourceFile?: string,
): LogEntry[] {
    const entries = parseLogContent(content, sourceFile);
    return filterEntries(entries, filter);
}
