/**
 * Centralized logging utility for the application
 * Provides structured logging with different levels and environment-aware output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface LogEntry {
  timestamp: Date
  level: LogLevel
  context?: string
  message: string
  data?: unknown
}

class Logger {
  private static instance: Logger
  private logLevel: LogLevel
  private logs: LogEntry[] = []
  private maxLogs: number = 100

  private constructor() {
    // Set log level based on environment
    this.logLevel = process.env.NODE_ENV === 'production'
      ? LogLevel.WARN
      : LogLevel.DEBUG
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Set the minimum log level to output
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel
  }

  /**
   * Get stored logs (useful for debugging)
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Clear stored logs
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel
  }

  private addToHistory(entry: LogEntry): void {
    this.logs.push(entry)

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  private formatMessage(level: LogLevel, context: string | undefined, message: string): string {
    const timestamp = new Date().toISOString()
    const levelName = LogLevel[level]
    const contextStr = context ? `[${context}]` : ''
    return `${timestamp} ${levelName}${contextStr}: ${message}`
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      context,
      message,
      data
    }

    this.addToHistory(entry)

    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage(LogLevel.DEBUG, context, message)
      if (data !== undefined) {
        console.debug(formatted, data)
      } else {
        console.debug(formatted)
      }
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.INFO)) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      context,
      message,
      data
    }

    this.addToHistory(entry)

    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage(LogLevel.INFO, context, message)
      if (data !== undefined) {
        console.info(formatted, data)
      } else {
        console.info(formatted)
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.WARN)) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.WARN,
      context,
      message,
      data
    }

    this.addToHistory(entry)

    const formatted = this.formatMessage(LogLevel.WARN, context, message)
    if (data !== undefined) {
      console.warn(formatted, data)
    } else {
      console.warn(formatted)
    }
  }

  /**
   * Log an error message
   */
  error(message: string, context?: string, error?: unknown): void {
    if (!this.shouldLog(LogLevel.ERROR)) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      context,
      message,
      data: error
    }

    this.addToHistory(entry)

    const formatted = this.formatMessage(LogLevel.ERROR, context, message)
    if (error !== undefined) {
      console.error(formatted, error)
    } else {
      console.error(formatted)
    }
  }

  /**
   * Group related logs together
   */
  group(label: string, collapsed: boolean = false): void {
    if (process.env.NODE_ENV === 'development') {
      if (collapsed) {
        console.groupCollapsed(label)
      } else {
        console.group(label)
      }
    }
  }

  /**
   * End a log group
   */
  groupEnd(): void {
    if (process.env.NODE_ENV === 'development') {
      console.groupEnd()
    }
  }

  /**
   * Log execution time of a function
   */
  async time<T>(
    label: string,
    fn: () => Promise<T> | T,
    context?: string
  ): Promise<T> {
    const start = performance.now()

    try {
      const result = await fn()
      const duration = performance.now() - start

      this.debug(
        `${label} completed in ${duration.toFixed(2)}ms`,
        context,
        { duration }
      )

      return result
    } catch (error) {
      const duration = performance.now() - start

      this.error(
        `${label} failed after ${duration.toFixed(2)}ms`,
        context,
        error
      )

      throw error
    }
  }

  /**
   * Create a table from data (development only)
   */
  table(data: unknown, context?: string): void {
    if (process.env.NODE_ENV === 'development') {
      if (context) {
        console.log(`[${context}]`)
      }
      console.table(data)
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Convenience exports
export const log = {
  debug: (message: string, context?: string, data?: unknown) =>
    logger.debug(message, context, data),

  info: (message: string, context?: string, data?: unknown) =>
    logger.info(message, context, data),

  warn: (message: string, context?: string, data?: unknown) =>
    logger.warn(message, context, data),

  error: (message: string, context?: string, error?: unknown) =>
    logger.error(message, context, error),

  group: (label: string, collapsed?: boolean) =>
    logger.group(label, collapsed),

  groupEnd: () =>
    logger.groupEnd(),

  time: <T>(label: string, fn: () => Promise<T> | T, context?: string) =>
    logger.time(label, fn, context),

  table: (data: unknown, context?: string) =>
    logger.table(data, context)
}
