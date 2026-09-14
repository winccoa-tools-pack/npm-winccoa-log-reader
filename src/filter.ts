import type { LogEntry, LogFilterOptions } from './types';

function asList<T>(value: T | T[] | undefined): T[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Include semantics (CTRL LogEntry.matchByMap):
 * - missing include key → pass
 * - empty include list → pass
 * - non-empty include → entry must match at least one value
 *
 * Exclude: any match → reject.
 * Strings: case-insensitive equality, except textContains / includeErrorText /
 * excludeErrorText which use case-insensitive substring.
 */
function includeString(actual: string, allowed: string[] | undefined, substring = false): boolean {
    const list = asList(allowed).filter((s) => s !== undefined && s !== '');
    if (list.length === 0) return true;
    const hay = actual.toLowerCase();
    return list.some((a) => {
        const needle = String(a).toLowerCase();
        return substring ? hay.includes(needle) : hay === needle;
    });
}

function excludeString(actual: string, blocked: string[] | undefined, substring = false): boolean {
    const list = asList(blocked).filter((s) => s !== undefined && s !== '');
    if (list.length === 0) return false;
    const hay = actual.toLowerCase();
    return list.some((a) => {
        const needle = String(a).toLowerCase();
        return substring ? hay.includes(needle) : hay === needle;
    });
}

function includeNumber(actual: number | undefined, allowed: number[] | undefined): boolean {
    const list = asList(allowed).filter((n) => n !== undefined && !Number.isNaN(n));
    if (list.length === 0) return true;
    if (actual === undefined) return false;
    return list.includes(actual);
}

function excludeNumber(actual: number | undefined, blocked: number[] | undefined): boolean {
    const list = asList(blocked).filter((n) => n !== undefined && !Number.isNaN(n));
    if (list.length === 0) return false;
    if (actual === undefined) return false;
    return list.includes(actual);
}

/** True when the entry passes the filter map. Empty filter → all pass. */
export function matchesFilter(entry: LogEntry, filter?: LogFilterOptions): boolean {
    if (!filter || Object.keys(filter).length === 0) {
        return true;
    }

    if (!includeString(entry.managerName, filter.includeManagerName)) return false;
    if (!includeNumber(entry.managerNum, filter.includeManagerNum)) return false;
    if (!includeString(entry.errorType, filter.includeErrorType)) return false;
    if (!includeString(entry.errorPriority, filter.includeErrorPriority?.map(String))) {
        return false;
    }
    if (!includeNumber(entry.errorCode, filter.includeErrorCode)) return false;
    if (!includeString(entry.errorCatalog ?? '', filter.includeErrorCatalog)) return false;
    if (!includeString(entry.errorText, filter.includeErrorText, true)) return false;
    if (!includeString(entry.errorText, filter.textContains, true)) return false;

    if (excludeString(entry.managerName, filter.excludeManagerName)) return false;
    if (excludeNumber(entry.managerNum, filter.excludeManagerNum)) return false;
    if (excludeString(entry.errorType, filter.excludeErrorType)) return false;
    if (excludeString(entry.errorPriority, filter.excludeErrorPriority?.map(String))) {
        return false;
    }
    if (excludeNumber(entry.errorCode, filter.excludeErrorCode)) return false;
    if (excludeString(entry.errorCatalog ?? '', filter.excludeErrorCatalog)) return false;
    if (excludeString(entry.errorText, filter.excludeErrorText, true)) return false;

    return true;
}

/** Filter a list of entries. */
export function filterEntries(entries: LogEntry[], filter?: LogFilterOptions): LogEntry[] {
    if (!filter || Object.keys(filter).length === 0) {
        return entries;
    }
    return entries.filter((e) => matchesFilter(e, filter));
}
