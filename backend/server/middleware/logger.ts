import { Request, Response, NextFunction } from 'express';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
  responseTime?: number;
  error?: any;
  errors?: any; // For validation errors
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  private createLogEntry(level: LogEntry['level'], message: string, extra?: Partial<LogEntry>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...extra
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Console output for development
    const logMessage = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
    
    switch (entry.level) {
      case 'error':
        console.error(logMessage, entry.error || '');
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  info(message: string, extra?: Partial<LogEntry>) {
    this.addLog(this.createLogEntry('info', message, extra));
  }

  warn(message: string, extra?: Partial<LogEntry>) {
    this.addLog(this.createLogEntry('warn', message, extra));
  }

  error(message: string, error?: any, extra?: Partial<LogEntry>) {
    this.addLog(this.createLogEntry('error', message, { ...extra, error }));
  }

  getLogs(level?: LogEntry['level'], limit = 100): LogEntry[] {
    let filteredLogs = level ? this.logs.filter(log => log.level === level) : this.logs;
    return filteredLogs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();

// Express middleware for request logging
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'info';
    
    logger[logLevel](`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime
    });
  });
  
  next();
}

// Express error handling middleware
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(`Request failed: ${req.method} ${req.url}`, err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
}