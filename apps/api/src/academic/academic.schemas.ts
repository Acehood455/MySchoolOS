import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const metadataSchema = z.record(z.unknown()).optional();

const nameSchema = z.string().trim().min(2).max(120);
const codeSchema = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._\/\-\s]*$/, "Expected an academic code");
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

export const academicYearSchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  metadata: metadataSchema
});

export const updateAcademicYearSchema = academicYearSchema.partial().extend({
  metadata: metadataSchema
});

export const termSchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  metadata: metadataSchema
});

export const updateTermSchema = termSchema.partial().extend({
  metadata: metadataSchema
});

export const classSchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(),
  metadata: metadataSchema
});

export const updateClassSchema = classSchema.partial().extend({
  metadata: metadataSchema
});

export const subjectSchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(),
  metadata: metadataSchema
});

export const updateSubjectSchema = subjectSchema.partial().extend({
  metadata: metadataSchema
});

export const listTermsQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional()
});

export const listClassesQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional()
});

export const createAcademicYearRequestSchema = academicYearSchema;
export const updateAcademicYearRequestSchema = updateAcademicYearSchema;
export const createTermRequestSchema = termSchema;
export const updateTermRequestSchema = updateTermSchema;
export const createClassRequestSchema = classSchema;
export const updateClassRequestSchema = updateClassSchema;
export const createSubjectRequestSchema = subjectSchema;
export const updateSubjectRequestSchema = updateSubjectSchema;

export function parseAcademicBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseAcademicQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
