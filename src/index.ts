/**
 * @winccoa-tools-pack/npm-winccoa-log
 *
 * Parse and watch WinCC OA PVSS log files from Node.js.
 */

// Types
export type {
    LogSeverity,
    LogFileRef,
    StacktraceEntry,
    LogMetadata,
    LogEvent,
    LogReadOptions,
    LogReadResult,
    LogWatcherOptions,
} from './types.js';

// Core classes
export { LogParser, parseLogContent } from './parser.js';
export { readLog } from './reader.js';
export { LogWatcher } from './watcher.js';

// Convenience API
export { createWatcher } from './api.js';
