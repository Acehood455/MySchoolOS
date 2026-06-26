import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);

export const resultStatusSchema = z.enum(["draft", "computed", "reviewed", "published"]);

export const computeResultSchema = z.object({
  studentId: idSchema
});

export const resultIdParamsSchema = z.object({
  resultId: idSchema
});

export const assessmentIdParamsSchema = z.object({
  assessmentId: idSchema
});

export const classIdParamsSchema = z.object({
  classId: idSchema
});

export const studentIdParamsSchema = z.object({
  studentId: idSchema
});

export const subjectIdParamsSchema = z.object({
  subjectId: idSchema
});

export const termIdParamsSchema = z.object({
  termId: idSchema
});

export const computeResultRequestSchema = computeResultSchema;

export function parseResultBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseResultQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
  const parsed = schema.safeParse(query);

  if (!parsed.success) {
    throw new AppError("Invalid request query", {
      status: 400,
      code,
      details: {
        issues: parsed.error.flatten()
      }
    });
  }

  return parsed.data;
}
