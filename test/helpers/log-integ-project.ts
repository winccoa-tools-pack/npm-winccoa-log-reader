/**
 * Integration test helper for @winccoa-tools-pack/npm-winccoa-log.
 *
 * Registers a minimal fixture project, executes CTL scripts via WCCOActrl -n
 * (standalone — no Data/Event managers needed), and reads new log lines from
 * the project's log/PVSS_II.log file after each execution.
 */

import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
    ProjEnvProject,
    getWinCCOAInstallationPathByVersion,
    getAvailableWinCCOAVersions,
} from '@winccoa-tools-pack/npm-winccoa-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Name used to register the fixture project with pvssInst.conf */
export const INTEG_PROJECT_NAME = 'log-integ-test';

/** Absolute path to the committed fixture project directory */
export const FIXTURE_PROJECT_DIR = path.resolve(
    __dirname,
    '..',
    'fixtures',
    'projects',
    'log-integ-test',
);

/** Absolute path to the fixture CTL scripts directory */
export const FIXTURE_SCRIPTS_DIR = path.resolve(
    __dirname,
    '..',
    'fixtures',
    'scripts',
);

/** Path to the project's PVSS log file */
export const PROJECT_LOG_FILE = path.join(FIXTURE_PROJECT_DIR, 'log', 'PVSS_II.log');

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the first available WinCC OA version, or undefined. */
export function getTestVersion(): string | undefined {
    try {
        const versions = getAvailableWinCCOAVersions();
        return versions.length > 0 ? versions[0] : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Checks whether the WCCOActrl binary exists for the given version.
 * Returns its full path or undefined if not found.
 */
export function getCtrlBinaryPath(version: string): string | undefined {
    const installPath = getWinCCOAInstallationPathByVersion(version);
    if (!installPath) return undefined;

    const candidates = [
        path.join(installPath, 'bin', 'WCCOActrl'),
        path.join(installPath, 'bin', 'WCCOActrl.exe'),
    ];
    return candidates.find((p) => fs.existsSync(p));
}

/**
 * Substitute <WinCC_OA_PATH>, <PROJECT_PATH>, and <WinCC_OA_VERSION>
 * tokens in config/config with real runtime values.
 */
export function patchConfig(version: string): boolean {
    const installPath = getWinCCOAInstallationPathByVersion(version);
    if (!installPath) return false;

    const configFile = path.join(FIXTURE_PROJECT_DIR, 'config', 'config');
    let content = fs.readFileSync(configFile, 'utf-8');

    // Idempotent: already patched
    if (!content.includes('<WinCC_OA_PATH>')) return true;

    content = content.replace('<WinCC_OA_PATH>', installPath.replace(/\\/g, '/'));
    content = content.replace('<PROJECT_PATH>', FIXTURE_PROJECT_DIR.replace(/\\/g, '/'));
    content = content.replace('<WinCC_OA_VERSION>', version);

    fs.writeFileSync(configFile, content, 'utf-8');
    return true;
}

/** Restore config tokens so the fixture can be committed unchanged. */
export function restoreConfig(): void {
    const configFile = path.join(FIXTURE_PROJECT_DIR, 'config', 'config');
    let content = fs.readFileSync(configFile, 'utf-8');

    if (content.includes('<WinCC_OA_PATH>')) return; // already restored

    content = content.replace(/^pvss_path = ".*"$/m, 'pvss_path = "<WinCC_OA_PATH>"');
    content = content.replace(/^proj_path = ".*"$/m, 'proj_path = "<PROJECT_PATH>"');
    content = content.replace(/^proj_version = ".*"$/m, 'proj_version = "<WinCC_OA_VERSION>"');

    fs.writeFileSync(configFile, content, 'utf-8');
}

// ── Project lifecycle ─────────────────────────────────────────────────────────

let registeredProject: ProjEnvProject | null = null;

/**
 * Register the fixture project.  Must be called once before running scripts.
 * Also ensures the log/ directory exists.
 * @returns The registered project, or null if registration fails.
 */
export async function setupLogProject(version: string): Promise<ProjEnvProject | null> {
    if (!patchConfig(version)) return null;

    // Ensure the log directory exists so WCCOActrl can write to it
    const logDir = path.join(FIXTURE_PROJECT_DIR, 'log');
    fs.mkdirSync(logDir, { recursive: true });

    const project = new ProjEnvProject();
    project.setRunnable(false);
    project.setDir(FIXTURE_PROJECT_DIR);
    project.setName(INTEG_PROJECT_NAME);
    project.setVersion(version);

    try {
        await project.registerProj();
        registeredProject = project;
        return project;
    } catch {
        restoreConfig();
        return null;
    }
}

/**
 * Unregister the fixture project and restore config tokens.
 */
export async function teardownLogProject(): Promise<void> {
    try {
        if (registeredProject) {
            await registeredProject.unregisterProj();
            registeredProject = null;
        }
    } finally {
        restoreConfig();
    }
}

// ── Script execution ─────────────────────────────────────────────────────────

export interface ScriptRunResult {
    exitCode: number;
    /** New PVSS log lines appended to log/PVSS_II.log during execution */
    output: string;
}

/**
 * Run a CTL script in standalone mode (-n).
 *
 * The script output is read from the project's log/PVSS_II.log file — 
 * WCCOActrl writes PVSS-formatted log lines there, not to stdout/stderr.
 *
 * @param scriptPath  Absolute path to the .ctl file
 * @param version     WinCC OA version string
 * @param timeoutMs   Process timeout in ms (default: 30 000)
 */
export function runScript(
    scriptPath: string,
    version: string,
    timeoutMs = 30_000,
): ScriptRunResult {
    const binaryPath = getCtrlBinaryPath(version);
    if (!binaryPath) {
        return { exitCode: -1, output: '' };
    }

    // Snapshot log file size before execution
    let beforeSize = 0;
    try {
        beforeSize = fs.statSync(PROJECT_LOG_FILE).size;
    } catch {
        // Log file doesn't exist yet — start from 0
    }

    spawnSync(binaryPath, [scriptPath, '-proj', INTEG_PROJECT_NAME, '-n'], {
        encoding: 'utf8',
        timeout: timeoutMs,
        env: { ...process.env },
    });

    // Read new content appended to the log file since before execution
    let output = '';
    try {
        const afterSize = fs.statSync(PROJECT_LOG_FILE).size;
        if (afterSize > beforeSize) {
            const buf = Buffer.allocUnsafe(afterSize - beforeSize);
            const fd = fs.openSync(PROJECT_LOG_FILE, 'r');
            fs.readSync(fd, buf, 0, buf.length, beforeSize);
            fs.closeSync(fd);
            output = buf.toString('utf8');
        }
    } catch {
        // Log file not written — return empty
    }

    return {
        exitCode: 0,
        output,
    };
}
