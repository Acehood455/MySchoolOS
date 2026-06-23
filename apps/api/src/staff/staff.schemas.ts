import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const metadataSchema = z.record(z.unknown()).optional();

const nameSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z][A-Za-z' -]*$/, "Expected a valid name");
const employeeNumberSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Expected a valid employee number");
const emailSchema = z.string().trim().email().max(254).optional();
const phoneSchema = z.string().trim().min(5).max(32).optional();
const genderSchema = z.string().trim().min(1).max(30).optional();
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

export const staffRoleTypeSchema = z.enum(["teacher", "administrator", "accountant", "receptionist", "librarian", "other"]);
export const staffStatusSchema = z.enum(["active", "inactive", "archived"]);

export const createStaffSchema = z.object({
  employeeNumber: employeeNumberSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  middleName: nameSchema.optional(),
  email: emailSchema,
  phone: phoneSchema,
  gender: genderSchema,
  dateOfBirth: dateSchema.optional(),
  employmentDate: dateSchema.optional(),
  roleType: staffRoleTypeSchema,
  metadata: metadataSchema
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  status: staffStatusSchema.optional(),
  metadata: metadataSchema
});

export const createTeacherClassAssignmentSchema = z.object({
  classId: idSchema
});

export const createTeacherSubjectAssignmentSchema = z.object({
  subjectId: idSchema
});

export const staffListQuerySchema = z.object({
  status: staffStatusSchema.optional()
});

export const createStaffRequestSchema = createStaffSchema;
export const updateStaffRequestSchema = updateStaffSchema;
export const createTeacherClassAssignmentRequestSchema = createTeacherClassAssignmentSchema;
export const createTeacherSubjectAssignmentRequestSchema = createTeacherSubjectAssignmentSchema;

export function parseStaffBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseStaffQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
