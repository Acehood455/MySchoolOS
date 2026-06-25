import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const titleSchema = z.string().trim().min(1).max(160);
const descriptionSchema = z.string().trim().min(1).max(1000).optional();
const positiveScoreSchema = z.number().finite().positive().max(100000);
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date in YYYY-MM-DD format")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .superRefine((value, ctx) => {
    if (Number.isNaN(value.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a valid date"
      });
    }
  });

export const assessmentTypeSchema = z.enum(["CA1", "CA2", "EXAM"]);
export const assessmentStatusSchema = z.enum(["draft", "open", "closed", "archived"]);

export const createAssessmentSchema = z
  .object({
    academicYearId: idSchema,
    termId: idSchema,
    classId: idSchema,
    subjectId: idSchema,
    assessmentType: assessmentTypeSchema,
    title: titleSchema,
    description: descriptionSchema,
    maxScore: positiveScoreSchema,
    opensAt: dateSchema,
    closesAt: dateSchema
  })
  .superRefine((value, ctx) => {
    if (value.opensAt.getTime() >= value.closesAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "opensAt must be before closesAt",
        path: ["opensAt"]
      });
    }
  });

export const updateAssessmentSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema,
    maxScore: positiveScoreSchema.optional(),
    opensAt: dateSchema.optional(),
    closesAt: dateSchema.optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "At least one field must be provided"
  })
  .superRefine((value, ctx) => {
    if (value.opensAt && value.closesAt && value.opensAt.getTime() >= value.closesAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "opensAt must be before closesAt",
        path: ["opensAt"]
      });
    }
  });

export const listAssessmentsQuerySchema = z.object({
  academicYearId: idSchema.optional(),
  termId: idSchema.optional(),
  classId: idSchema.optional(),
  subjectId: idSchema.optional(),
  assessmentType: assessmentTypeSchema.optional(),
  status: assessmentStatusSchema.optional()
});

export const assessmentIdParamsSchema = z.object({
  assessmentId: idSchema
});

export const createAssessmentRequestSchema = createAssessmentSchema;
export const updateAssessmentRequestSchema = updateAssessmentSchema;
export const listAssessmentsRequestSchema = listAssessmentsQuerySchema;

export function parseAssessmentBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseAssessmentQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
