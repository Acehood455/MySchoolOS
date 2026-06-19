import { z } from "zod";
import { AppError } from "@myschoolos/shared";

export const loginRequestSchema = z.object({
  loginIdentifier: z.string().trim().min(1),
  password: z.string().min(1)
});

export const logoutRequestSchema = z.object({
  reason: z.string().trim().min(1).optional()
});

export const passwordResetRequestSchema = z.object({
  loginIdentifier: z.string().trim().min(1)
});

export const passwordResetCompleteSchema = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(8)
});

export function parseAuthBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new AppError("Invalid request body", {
      status: 400,
      code,
      details: {
        issues: parsed.error.flatten()
      }
    });
  }

  return parsed.data;
}
