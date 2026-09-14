/**
 * Live WinCC OA log file watcher using Node.js fs.watch.
 *
 * Emits 'event' for each new LogEvent detected in watched files and
 * 'error' for I/O problems.  Filtering options mirror readLog().
 *
 * Usage:
 *   const watcher = new LogWatcher({
 *     files: ['/path/to/PVSS_II.log'],
 *     filterSeverity: ['WARNING', 'FATAL'],
 *   });
 *   watcher.on('event', (e) => console.log(e));
 *   watcher.start();
 *   // ...later:
 *   watcher.stop();
 */

import { EventEmitter } from 'node:events';
import { watch, statSync, openSync, readSync, closeSync } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { LogParser } from './parser.js';
import type { LogEvent, LogWatcherOptions } from './types.js';

interface FileState {
    position: number;
    lineBuffer: string;
    parser: LogParser;
    fsWatcher: FSWatcher | null;
}

export class LogWatcher extends EventEmitter {
    private readonly opts: LogWatcherOptions;
    private readonly fileStates = new Map<string, FileState>();
    private running = false;

    constructor(opts: LogWatcherOptions) {
        super();
        this.opts = opts;
    }

    /** Start watching all configured files. */
    start(): void {
        if (this.running) return;
        this.running = true;

        for (const filePath of this.opts.files) {
            this.initFile(filePath);
        }
    }

    /** Stop all watchers and release resources. */
    stop(): void {
        if (!this.running) return;
        this.running = false;

        for (const state of this.fileStates.values()) {
            state.fsWatcher?.close();
            // Flush any buffered event
            const last = state.parser.flush();
            if (last) this.emitEvent(last);
        }

        this.fileStates.clear();
    }

    // ── Internal ────────────────────────────────────────────────────────────────

    private initFile(filePath: string): void {
        let size = 0;
        try {
            size = statSync(filePath).size;
        } catch {
            // File may not exist yet — start from 0
        }

        const state: FileState = {
            position: size,
            lineBuffer: '',
            parser: new LogParser(this.opts.debugCallback),
            fsWatcher: null,
        };

        this.fileStates.set(filePath, state);

        try {
            const fsWatcher = watch(filePath, (eventType) => {
                if (eventType === 'change') {
                    this.handleChange(filePath);
                }
            });

            fsWatcher.on('error', (err) => {
                this.emit('error', err);
            });

            state.fsWatcher = fsWatcher;
        } catch (err) {
            this.emit('error', err);
        }
    }

    private handleChange(filePath: string): void {
        const state = this.fileStates.get(filePath);
        if (!state) return;

        let currentSize = 0;
        try {
            currentSize = statSync(filePath).size;
        } catch {
            return;
        }

        if (currentSize < state.position) {
            // File was truncated/rotated — reset
            state.position = 0;
            state.lineBuffer = '';
            state.parser.reset();
        }

        if (currentSize <= state.position) return;

        let newContent: string;
        try {
            const buf = Buffer.allocUnsafe(currentSize - state.position);
            const fd = openSync(filePath, 'r');
            readSync(fd, buf, 0, buf.length, state.position);
            closeSync(fd);
            newContent = buf.toString('utf8');
        } catch (err) {
            this.emit('error', err);
            return;
        }

        state.position = currentSize;

        // Split into lines, respecting a partial last line
        const combined = state.lineBuffer + newContent;
        const lines = combined.split(/\n/);

        // The last element may be an incomplete line
        state.lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
            const events = state.parser.parseLine(line);
            for (const event of events) {
                event.sourceFile = filePath;
                this.emitEvent(event);
            }
        }
    }

    private passesFilters(event: LogEvent): boolean {
        if (this.opts.filterSeverity && this.opts.filterSeverity.length > 0) {
            if (!this.opts.filterSeverity.includes(event.severity)) return false;
        }
        if (this.opts.filterScope && this.opts.filterScope.length > 0) {
            if (!this.opts.filterScope.includes(event.scope)) return false;
        }
        return true;
    }

    private emitEvent(event: LogEvent): void {
        if (this.passesFilters(event)) {
            this.emit('event', event);
        }
    }
}
