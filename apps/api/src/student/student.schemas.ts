import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const metadataSchema = z.record(z.unknown()).optional();

const personNameSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z][A-Za-z' -]*$/, "Expected a valid name");
const middleNameSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z][A-Za-z' -]*$/, "Expected a valid middle name").optional();
const admissionNumberSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Expected a valid admission number");

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

export const studentGenderSchema = z.enum(["male", "female", "other", "unspecified"]);
export const studentStatusSchema = z.enum(["active", "inactive", "graduated", "withdrawn", "archived"]);

export const createStudentSchema = z.object({
  admissionNumber: admissionNumberSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  middleName: middleNameSchema,
  gender: studentGenderSchema.optional(),
  dateOfBirth: dateSchema.optional(),
  admissionDate: dateSchema.optional(),
  contactInformation: z.record(z.unknown()).optional(),
  address: z.record(z.unknown()).optional(),
  profilePhotoReference: z.string().trim().min(1).max(2048).optional(),
  metadata: metadataSchema
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: studentStatusSchema.optional(),
  metadata: metadataSchema
});

export const studentListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  admissionNumber: admissionNumberSchema.optional(),
  status: studentStatusSchema.optional()
});

export const createStudentRequestSchema = createStudentSchema;
export const updateStudentRequestSchema = updateStudentSchema;

export function parseStudentBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseStudentQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
