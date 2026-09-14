/**
 * @winccoa-tools-pack/npm-winccoa-log-reader
 *
 * Parse classic WinCC OA logs (PVSS_II.log) to structured JSON.
 * Aligned with CTRL oaLogs LogParserClassic / LogEntry and vscode-winccoa-logviewer.
 */

export type {
    LogEntry,
    LogFilterOptions,
    LogMetadata,
    LogSeverity,
    ReadLogOptions,
    StacktraceEntry,
} from './types';

export {
    filterEntries,
    matchesFilter,
    normalizeSeverity,
    parseLogContent,
    LogParser,
    readLogFile,
    readLogText,
} from './api';
