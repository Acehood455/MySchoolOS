export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  readonly requestId?: string | null;
  readonly correlationId?: string | null;
  readonly actorId?: string | null;
  readonly tenantId?: string | null;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  withContext(context: LogContext): Logger;
}

function normalizeContext(context?: LogContext): Required<LogContext> {
  return {
    requestId: context?.requestId ?? null,
    correlationId: context?.correlationId ?? null,
    actorId: context?.actorId ?? null,
    tenantId: context?.tenantId ?? null
  };
}

function mergeContext(base: Required<LogContext>, extra?: LogContext): Required<LogContext> {
  return {
    requestId: extra?.requestId !== undefined ? extra.requestId : base.requestId,
    correlationId: extra?.correlationId !== undefined ? extra.correlationId : base.correlationId,
    actorId: extra?.actorId !== undefined ? extra.actorId : base.actorId,
    tenantId: extra?.tenantId !== undefined ? extra.tenantId : base.tenantId
  };
}

function emit(
  level: LogLevel,
  scope: string,
  context: Required<LogContext>,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry = {
    level,
    scope,
    message,
    requestId: context.requestId,
    correlationId: context.correlationId,
    actorId: context.actorId,
    tenantId: context.tenantId,
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

export function createLogger(scope: string, context?: LogContext): Logger {
  const normalized = normalizeContext(context);

  return {
    debug(message, meta) {
      emit("debug", scope, normalized, message, meta);
    },
    info(message, meta) {
      emit("info", scope, normalized, message, meta);
    },
    warn(message, meta) {
      emit("warn", scope, normalized, message, meta);
    },
    error(message, meta) {
      emit("error", scope, normalized, message, meta);
    },
    withContext(extraContext) {
      return createLogger(scope, {
        ...mergeContext(normalized, extraContext)
      });
    }
  };
}
