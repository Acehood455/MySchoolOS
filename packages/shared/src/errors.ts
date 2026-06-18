import type { ProblemDetails } from "./types.js";

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  public constructor(message: string, options: { status?: number; code?: string; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "AppError";
    this.status = options.status ?? 500;
    this.code = options.code ?? "internal_error";
    this.details = options.details;
  }

  public toProblemDetails(instance?: string): ProblemDetails {
    return {
      type: "about:blank",
      title: this.message,
      status: this.status,
      detail: this.details ? JSON.stringify(this.details) : undefined,
      instance,
      code: this.code
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
