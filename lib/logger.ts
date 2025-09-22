interface LogContext {
  userId?: string;
  sessionId: string;
  task?: string;
  timestamp: string;
  component?: string;
  action?: string;
}

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  metadata?: Record<string, any>;
}

export const logger = {
  error: (message: string, context: LogContext, error?: Error, metadata?: Record<string, any>) => {
    const logEntry: LogEntry = {
      level: 'error',
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      metadata
    };
    
    console.error(JSON.stringify(logEntry));
    
    // In production, you might want to send this to a logging service
    if (process.env.NODE_ENV === 'production') {
      // Example: send to external logging service
      // logToService(logEntry);
    }
  },
  
  warn: (message: string, context: LogContext, metadata?: Record<string, any>) => {
    const logEntry: LogEntry = {
      level: 'warn',
      message,
      context,
      metadata
    };
    
    console.warn(JSON.stringify(logEntry));
  },
  
  info: (message: string, context: LogContext, metadata?: Record<string, any>) => {
    const logEntry: LogEntry = {
      level: 'info',
      message,
      context,
      metadata
    };
    
    console.info(JSON.stringify(logEntry));
  },
  
  debug: (message: string, context: LogContext, metadata?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      const logEntry: LogEntry = {
        level: 'debug',
        message,
        context,
        metadata
      };
      
      console.debug(JSON.stringify(logEntry));
    }
  }
};

// Utility function to generate session ID
export const generateSessionId = (): string => {
  return crypto.randomUUID();
};

// Utility function to create log context
export const createLogContext = (task?: string, component?: string, action?: string): LogContext => {
  return {
    sessionId: generateSessionId(),
    task,
    component,
    action,
    timestamp: new Date().toISOString()
  };
};
