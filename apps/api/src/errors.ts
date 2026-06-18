import { isAppError, type ProblemDetails, AppError } from "@myschoolos/shared";

export function toProblemDetails(error: unknown, instance?: string): ProblemDetails {
  if (isAppError(error)) {
    return error.toProblemDetails(instance);
  }

  if (error instanceof Error) {
    return new AppError(error.message, { status: 500, code: "internal_error" }).toProblemDetails(instance);
  }

  return new AppError("Unexpected error", { status: 500, code: "internal_error" }).toProblemDetails(instance);
}
