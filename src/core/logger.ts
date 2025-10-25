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
const defaultLogger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableStorage: false,
  maxEntries: 1000,
  context: 'CubeCrash'
});

// Export logger and types
export { defaultLogger as logger };
export type { Logger };
