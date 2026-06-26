import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const commentsSchema = z.string().trim().min(1).max(2000).optional();

export const reportCardStatusSchema = z.enum(["draft", "generated", "published"]);

export const reportCardIdParamsSchema = z.object({
  reportId: idSchema
});

export const reportCardScopeSchema = z.object({
  studentId: idSchema,
  classId: idSchema,
  academicYearId: idSchema,
  termId: idSchema,
  teacherComments: commentsSchema,
  principalComments: commentsSchema
});

export const listReportCardsQuerySchema = z.object({
  studentId: idSchema.optional(),
  classId: idSchema.optional(),
  academicYearId: idSchema.optional(),
  termId: idSchema.optional(),
  status: reportCardStatusSchema.optional()
});

export const generateReportCardRequestSchema = reportCardScopeSchema;
export const regenerateReportCardRequestSchema = reportCardScopeSchema.partial().extend({
  teacherComments: commentsSchema,
  principalComments: commentsSchema
});

export function parseReportCardBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseReportCardQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
