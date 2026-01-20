// Simple logger utility that works in both browser and server environments
// Avoids pino's worker threads which cause issues with Next.js

const isBrowser = typeof window !== 'undefined';

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;

// Format log message
const formatLog = (level, module, msg, data) => {
  const timestamp = new Date().toISOString();
  return {
    level,
    time: timestamp,
    module,
    msg,
    ...data
  };
};

// Store log in sessionStorage (browser only)
const storeLog = (logData) => {
  if (!isBrowser) return;

  try {
    const existingLogs = JSON.parse(sessionStorage.getItem('app_logs') || '[]');
    existingLogs.push(logData);
    // Keep only last 100 logs
    if (existingLogs.length > 100) {
      existingLogs.shift();
    }
    sessionStorage.setItem('app_logs', JSON.stringify(existingLogs));
  } catch (e) {
    // Ignore storage errors
  }
};

// Create a logger for a specific module
export const createModuleLogger = (moduleName) => {
  const log = (level, levelNum, msgOrData, data) => {
    if (levelNum < currentLevel) return;

    let msg = '';
    let logData = {};

    if (typeof msgOrData === 'string') {
      msg = msgOrData;
      logData = data || {};
    } else if (typeof msgOrData === 'object') {
      logData = msgOrData;
      msg = data || '';
    }

    const formattedLog = formatLog(level, moduleName, msg, logData);

    // Console output
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    const prefix = `[${formattedLog.time}] [${level.toUpperCase()}] [${moduleName}]`;

    if (Object.keys(logData).length > 0) {
      console[consoleMethod](prefix, msg, logData);
    } else {
      console[consoleMethod](prefix, msg);
    }

    // Store in sessionStorage for browser debugging
    storeLog(formattedLog);
  };

  return {
    debug: (msgOrData, data) => log('debug', LOG_LEVELS.debug, msgOrData, data),
    info: (msgOrData, data) => log('info', LOG_LEVELS.info, msgOrData, data),
    warn: (msgOrData, data) => log('warn', LOG_LEVELS.warn, msgOrData, data),
    error: (msgOrData, data) => log('error', LOG_LEVELS.error, msgOrData, data),
    child: (bindings) => createModuleLogger(`${moduleName}:${bindings.module || 'child'}`)
  };
};

// Default logger
const logger = createModuleLogger('app');

// Utility function to get stored logs (browser only)
export const getStoredLogs = () => {
  if (isBrowser) {
    try {
      return JSON.parse(sessionStorage.getItem('app_logs') || '[]');
    } catch (e) {
      return [];
    }
  }
  return [];
};

// Utility function to clear stored logs (browser only)
export const clearStoredLogs = () => {
  if (isBrowser) {
    try {
      sessionStorage.removeItem('app_logs');
    } catch (e) {
      // Ignore storage errors
    }
  }
};

// Utility function to download logs as JSON file
export const downloadLogs = () => {
  if (isBrowser) {
    const logs = getStoredLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

export default logger;
