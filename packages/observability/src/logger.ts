export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function emit(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    level,
    scope,
    message,
    meta,
    timestamp: new Date().toISOString()
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createLogger(scope: string): Logger {
  return {
    debug(message, meta) {
      emit("debug", scope, message, meta);
    },
    info(message, meta) {
      emit("info", scope, message, meta);
    },
    warn(message, meta) {
      emit("warn", scope, message, meta);
    },
    error(message, meta) {
      emit("error", scope, message, meta);
    }
  };
}
