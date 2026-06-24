import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const remarksSchema = z.string().trim().min(1).max(255).optional();
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

export const attendanceStatusSchema = z.enum(["present", "absent", "late", "excused"]);

export const markAttendanceSchema = z.object({
  enrollmentId: idSchema,
  academicYearId: idSchema,
  termId: idSchema,
  classId: idSchema,
  attendanceDate: dateSchema,
  status: attendanceStatusSchema,
  remarks: remarksSchema
});

export const updateAttendanceSchema = z.object({
  attendanceDate: dateSchema.optional(),
  status: attendanceStatusSchema.optional(),
  remarks: remarksSchema
});

export const listAttendanceQuerySchema = z.object({
  enrollmentId: idSchema.optional(),
  studentId: idSchema.optional(),
  academicYearId: idSchema.optional(),
  termId: idSchema.optional(),
  classId: idSchema.optional(),
  attendanceDate: dateSchema.optional(),
  status: attendanceStatusSchema.optional()
});

export const bulkAttendanceEntrySchema = z.object({
  enrollmentId: idSchema,
  status: attendanceStatusSchema,
  remarks: remarksSchema
});

export const bulkAttendanceSchema = z
  .object({
    academicYearId: idSchema,
    termId: idSchema,
    classId: idSchema,
    attendanceDate: dateSchema,
    entries: z.array(bulkAttendanceEntrySchema).min(1).max(200)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    for (const [index, entry] of value.entries.entries()) {
      if (seen.has(entry.enrollmentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate enrollment entry in bulk attendance",
          path: ["entries", index, "enrollmentId"]
        });
      }

      seen.add(entry.enrollmentId);
    }
  });

export const attendanceSummaryQuerySchema = z.object({
  studentId: idSchema.optional(),
  classId: idSchema.optional(),
  academicYearId: idSchema.optional(),
  termId: idSchema.optional()
});

export const attendanceByDateQuerySchema = z.object({
  attendanceDate: dateSchema,
  classId: idSchema.optional()
});

export const markAttendanceRequestSchema = markAttendanceSchema;
export const updateAttendanceRequestSchema = updateAttendanceSchema;
export const listAttendanceRequestSchema = listAttendanceQuerySchema;
export const bulkAttendanceRequestSchema = bulkAttendanceSchema;
export const attendanceSummaryRequestSchema = attendanceSummaryQuerySchema;
export const attendanceByDateRequestSchema = attendanceByDateQuerySchema;

export function parseAttendanceBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseAttendanceQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
