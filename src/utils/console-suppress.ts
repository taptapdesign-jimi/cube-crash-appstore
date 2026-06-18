// Central console noise control.
// Modes:
// - quiet: only console.error
// - smart: warnings + high-signal logs, filters repetitive noise
// - verbose: full console
// DevTools helpers:
//   window.__ccSetConsoleMode('quiet' | 'smart' | 'verbose')
//   window.__ccSetConsoleVerbose(true|false)  // backward compatible
if (import.meta.env.DEV) {
const STORAGE_KEY = 'cc_console_mode';

const originalConsole = {
  log: console.log.bind(console),
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const noop = () => {};

type ConsoleMode = 'quiet' | 'smart' | 'verbose';

const noisyPatterns: RegExp[] = [
  /found in cache/i,
  /openLockedBounceParallel/i,
  /Temporarily cleared grid/i,
  /Board stats saved/i,
  /cubes cracked/i,
  /requestAnimationFrame/i,
  /Created \d+ shards/i,
  /Cleaning up \d+ FX containers/i,
];

const smartSignalPatterns: RegExp[] = [
  /error|fatal|exception|failed|timeout|stuck|no moves|fail screen|clean board/i,
  /endgame|checkLevelEnd|merge|spawn|wild|magnet|tnt/i,
  /deprecated|blocked call|intervention/i,
];

function normalizeLogMessage(args: any[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');
}

function shouldEmitSmart(level: 'log' | 'debug' | 'info' | 'warn', args: any[]): boolean {
  const msg = normalizeLogMessage(args);
  if (!msg) return false;

  if (noisyPatterns.some((re) => re.test(msg))) return false;

  if (level === 'warn') return true;
  if (level === 'debug') return false;

  return smartSignalPatterns.some((re) => re.test(msg));
}

function applyConsoleMode(mode: ConsoleMode): void {
  if (mode === 'verbose') {
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    return;
  }

  if (mode === 'quiet') {
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    console.error = originalConsole.error;
    return;
  }

  // smart
  console.log = (...args: any[]) => {
    if (shouldEmitSmart('log', args)) originalConsole.log(...args);
  };
  console.debug = (...args: any[]) => {
    if (shouldEmitSmart('debug', args)) originalConsole.debug(...args);
  };
  console.info = (...args: any[]) => {
    if (shouldEmitSmart('info', args)) originalConsole.info(...args);
  };
  console.warn = (...args: any[]) => {
    if (shouldEmitSmart('warn', args)) originalConsole.warn(...args);
  };
  console.error = originalConsole.error;
}

let mode: ConsoleMode = 'verbose';
try {
  if (typeof window !== 'undefined') {
    const explicitMode = (window as any).__ccConsoleMode;
    if (explicitMode === 'quiet' || explicitMode === 'smart' || explicitMode === 'verbose') {
      mode = explicitMode;
    } else {
      mode = 'verbose';
    }
  }
} catch {}

applyConsoleMode(mode);

if (typeof window !== 'undefined') {
  (window as any).__ccSetConsoleMode = (nextMode: ConsoleMode) => {
    const normalized: ConsoleMode =
      nextMode === 'verbose' || nextMode === 'smart' || nextMode === 'quiet'
        ? nextMode
        : 'verbose';
    (window as any).__ccConsoleMode = normalized;
    (window as any).__ccVerboseGameplayLogs = normalized === 'verbose';
    try { window.localStorage?.setItem(STORAGE_KEY, normalized); } catch {}
    applyConsoleMode(normalized);
    originalConsole.log(`✅ Console mode set to: ${normalized}`);
  };

  (window as any).__ccSetConsoleVerbose = (enabled: boolean) => {
    const verbose = enabled === true;
    const nextMode: ConsoleMode = verbose ? 'verbose' : 'quiet';
    (window as any).__ccConsoleMode = nextMode;
    (window as any).__ccVerboseGameplayLogs = verbose;
    try { window.localStorage?.setItem(STORAGE_KEY, nextMode); } catch {}
    applyConsoleMode(nextMode);
    if (verbose) {
      originalConsole.log('✅ Console verbose logging enabled');
    }
  };
}
}

export {};
