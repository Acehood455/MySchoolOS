import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
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

export const enrollmentStatusSchema = z.enum(["active", "transferred", "withdrawn", "graduated", "archived"]);

export const createEnrollmentSchema = z.object({
  studentId: idSchema,
  academicYearId: idSchema,
  classId: idSchema,
  admissionDate: dateSchema.optional(),
  enrollmentStatus: enrollmentStatusSchema.optional()
});

export const updateEnrollmentSchema = z.object({
  admissionDate: dateSchema.optional(),
  enrollmentStatus: enrollmentStatusSchema.optional()
});

export const enrollmentListQuerySchema = z.object({
  studentId: idSchema.optional(),
  academicYearId: idSchema.optional(),
  classId: idSchema.optional(),
  enrollmentStatus: enrollmentStatusSchema.optional()
});

export const movementSchema = z.object({
  toClassId: idSchema,
  movementDate: dateSchema.optional(),
  reason: z.string().trim().min(1).max(255).optional()
});

export const createEnrollmentRequestSchema = createEnrollmentSchema;
export const updateEnrollmentRequestSchema = updateEnrollmentSchema;
export const enrollmentListRequestSchema = enrollmentListQuerySchema;
export const movementRequestSchema = movementSchema;

export function parseEnrollmentBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseEnrollmentQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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

