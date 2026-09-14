/**
 * Convenience API — re-exports common functions with minimal boilerplate.
 */

export { readLog } from './reader.js';
export { LogWatcher } from './watcher.js';
export { parseLogContent, LogParser } from './parser.js';

import { LogWatcher } from './watcher.js';
import type { LogWatcherOptions } from './types.js';

/**
 * Create and start a LogWatcher in one call.
 *
 * @example
 * ```ts
 * const watcher = createWatcher({
 *   files: ['/opt/winccoa/log/PVSS_II.log'],
 *   filterSeverity: ['WARNING', 'FATAL', 'SEVERE'],
 * });
 * watcher.on('event', (e) => console.log(JSON.stringify(e)));
 * // call watcher.stop() to clean up
 * ```
 */
export function createWatcher(opts: LogWatcherOptions): LogWatcher {
    const watcher = new LogWatcher(opts);
    watcher.start();
    return watcher;
}
