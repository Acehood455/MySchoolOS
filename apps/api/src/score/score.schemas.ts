import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const scoreValueSchema = z.number().finite().min(0);

export const scoreEntrySchema = z.object({
  studentId: idSchema,
  score: scoreValueSchema
});

export const submitScoreSchema = scoreEntrySchema;
export const updateScoreSchema = z.object({
  score: scoreValueSchema
});

export const bulkSubmitScoresSchema = z
  .object({
    entries: z.array(scoreEntrySchema).min(1).max(500)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    for (const [index, entry] of value.entries.entries()) {
      if (seen.has(entry.studentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate student entry in bulk score submission",
          path: ["entries", index, "studentId"]
        });
      }

      seen.add(entry.studentId);
    }
  });

export const scoreIdParamsSchema = z.object({
  scoreId: idSchema
});

export const assessmentIdParamsSchema = z.object({
  assessmentId: idSchema
});

export const studentIdParamsSchema = z.object({
  studentId: idSchema
});

export const submitScoreRequestSchema = submitScoreSchema;
export const updateScoreRequestSchema = updateScoreSchema;
export const bulkSubmitScoresRequestSchema = bulkSubmitScoresSchema;

export function parseScoreBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseScoreQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
