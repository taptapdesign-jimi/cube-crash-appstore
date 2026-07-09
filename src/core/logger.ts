// Logger System for CubeCrash
// Swift-compatible logging architecture

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxEntries: number;
  context?: string;
}

class Logger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private isProduction: boolean;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createEntry(level: LogLevel, message: string, context?: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || this.config.context,
      data
    };
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, context, data);
    
    // Add to entries array
    this.entries.push(entry);
    
    // Keep only max entries
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // Console output (only in development)
    if (this.config.enableConsole && !this.isProduction) {
      const levelName = LogLevel[level];
      const prefix = `[${levelName}] ${entry.timestamp}`;
      const contextStr = entry.context ? ` [${entry.context}]` : '';
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(`${prefix}${contextStr} ${message}`, data || '');
          break;
        case LogLevel.INFO:
          console.info(`${prefix}${contextStr} ${message}`, data || '');
          break;
        case LogLevel.WARN:
          console.warn(`${prefix}${contextStr} ${message}`, data || '');
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(`${prefix}${contextStr} ${message}`, data || '');
          break;
      }
    }

    // Storage (if enabled)
    if (this.config.enableStorage) {
      this.saveToStorage();
    }
  }

  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  fatal(message: string, context?: string, data?: any): void {
    this.log(LogLevel.FATAL, message, context, data);
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('cubeCrash_logs', JSON.stringify(this.entries));
    } catch (error) {
      // Silently fail if storage is not available
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    if (this.config.enableStorage) {
      try {
        localStorage.removeItem('cubeCrash_logs');
      } catch (error) {
        // Silently fail if storage is not available
      }
    }
  }

  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}

// Create default logger instance
// 🔥 OPTIMIZATION: Default to WARN level to reduce console noise
// Set LOG_LEVEL environment variable to override (DEBUG, INFO, WARN, ERROR, FATAL)
const getLogLevel = (): LogLevel => {
  const envLevel = typeof window !== 'undefined' ? (window as any).__ccLogLevel : undefined;
  
  if (envLevel) {
    const upper = String(envLevel).toUpperCase();
    if (upper === 'DEBUG') return LogLevel.DEBUG;
    if (upper === 'INFO') return LogLevel.INFO;
    if (upper === 'WARN') return LogLevel.WARN;
    if (upper === 'ERROR') return LogLevel.ERROR;
    if (upper === 'FATAL') return LogLevel.FATAL;
  }
  
  // Default: WARN (only warnings and errors)
  // Change to INFO for development debugging
  return LogLevel.WARN;
};

const defaultLogger = new Logger({
  level: getLogLevel(),
  enableConsole: true,
  enableStorage: false,
  maxEntries: 1000,
  context: 'CubeCrash'
});

// Export logger and types
export { defaultLogger as logger };
export type { Logger };

// 🔧 DEBUG HELPER: Expose logger control to window for easy debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).__ccLogger = {
    // Set log level dynamically
    setLevel: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL') => {
      const levelMap: Record<string, LogLevel> = {
        'DEBUG': LogLevel.DEBUG,
        'INFO': LogLevel.INFO,
        'WARN': LogLevel.WARN,
        'ERROR': LogLevel.ERROR,
        'FATAL': LogLevel.FATAL
      };
      (defaultLogger as any).config.level = levelMap[level] || LogLevel.WARN;
      console.log(`✅ Logger level set to: ${level}`);
    },
    // Get current log level
    getLevel: () => {
      const level = (defaultLogger as any).config.level;
      const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
      return levelNames[level] || 'WARN';
    },
    // Show all logs (DEBUG level)
    showAll: () => {
      (defaultLogger as any).config.level = LogLevel.DEBUG;
      console.log('✅ Logger: Showing all logs (DEBUG level)');
    },
    // Show only warnings and errors (default)
    showWarnings: () => {
      (defaultLogger as any).config.level = LogLevel.WARN;
      console.log('✅ Logger: Showing only warnings and errors (WARN level)');
    },
    // Export logs to clipboard-friendly format
    exportLogs: () => {
      const entries = (defaultLogger as any).entries || [];
      const logText = entries.map((entry: LogEntry) => {
        const level = LogLevel[entry.level];
        const time = entry.timestamp;
        const context = entry.context ? ` [${entry.context}]` : '';
        const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
        return `[${level}] ${time}${context} ${entry.message}${data}`;
      }).join('\n');
      
      // Copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(logText).then(() => {
          console.log('✅ Logs copied to clipboard!');
        }).catch(() => {
          console.log('⚠️ Failed to copy to clipboard, showing in console:');
          console.log(logText);
        });
      } else {
        console.log('⚠️ Clipboard API not available, showing logs:');
        console.log(logText);
      }
      return logText;
    },
    // Get logs as array
    getLogs: () => {
      return (defaultLogger as any).entries || [];
    },
    // Clear logs
    clear: () => {
      defaultLogger.clear();
      console.log('✅ Logs cleared');
    }
  };
  
  // Also expose LogLevel enum for convenience
  (window as any).__ccLogLevels = {
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR,
    FATAL: LogLevel.FATAL
  };
}
