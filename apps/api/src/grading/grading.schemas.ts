import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const nameSchema = z.string().trim().min(1).max(160);
const versionSchema = z.union([z.string(), z.number()]).transform((value) => `${value}`.trim()).pipe(z.string().min(1).max(50));
const weightSchema = z.number().finite().min(0).max(100);
const gradeSchema = z.string().trim().min(1).max(20);
const gradeBoundaryDefinitionSchema = z.object({
  grade: gradeSchema,
  minScore: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(0).max(100),
  remark: z.string().trim().min(1).max(200).optional()
});

function assertBoundaryCoverage(boundaries: readonly z.infer<typeof gradeBoundaryDefinitionSchema>[], ctx: z.RefinementCtx): void {
  if (boundaries.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "gradeBoundaries must contain at least one range",
      path: ["gradeBoundaries"]
    });
    return;
  }

  const sorted = [...boundaries].sort((left, right) => left.minScore - right.minScore || left.maxScore - right.maxScore);
  const seenGrades = new Set<string>();
  let expectedMin = 0;

  for (const [index, boundary] of sorted.entries()) {
    if (seenGrades.has(boundary.grade)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate grade labels are not allowed",
        path: ["gradeBoundaries", index, "grade"]
      });
    }
    seenGrades.add(boundary.grade);

    if (boundary.minScore > boundary.maxScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minScore must be less than or equal to maxScore",
        path: ["gradeBoundaries", index, "minScore"]
      });
    }

    if (boundary.minScore !== expectedMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "gradeBoundaries must cover 0-100 without gaps",
        path: ["gradeBoundaries", index, "minScore"]
      });
    }

    if (index > 0) {
      const previous = sorted[index - 1]!;

      if (boundary.minScore <= previous.maxScore) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "gradeBoundaries cannot overlap",
          path: ["gradeBoundaries", index, "minScore"]
        });
      }
    }

    expectedMin = boundary.maxScore + 1;
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first || !last) {
    return;
  }

  if (first.minScore !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "gradeBoundaries must start at 0",
      path: ["gradeBoundaries", 0, "minScore"]
    });
  }

  if (last.maxScore !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "gradeBoundaries must end at 100",
      path: ["gradeBoundaries", sorted.length - 1, "maxScore"]
    });
  }
}

export const gradeBoundarySchema = gradeBoundaryDefinitionSchema;
export const gradingPolicyStatusSchema = z.enum(["draft", "active", "archived"]);

export const createGradingPolicySchema = z
  .object({
    name: nameSchema,
    version: versionSchema,
    ca1Weight: weightSchema,
    ca2Weight: weightSchema,
    examWeight: weightSchema,
    gradeBoundaries: z.array(gradeBoundarySchema).min(1).max(20),
    remarks: z.string().trim().min(1).max(1000).optional(),
    effectiveFrom: z.coerce.date()
  })
  .superRefine((value, ctx) => {
    const weightTotal = Math.round((value.ca1Weight + value.ca2Weight + value.examWeight) * 1000) / 1000;

    if (weightTotal !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weights must total exactly 100",
        path: ["ca1Weight"]
      });
    }

    assertBoundaryCoverage(value.gradeBoundaries, ctx);
  });

export const updateGradingPolicySchema = z
  .object({
    name: nameSchema.optional(),
    version: versionSchema.optional(),
    ca1Weight: weightSchema.optional(),
    ca2Weight: weightSchema.optional(),
    examWeight: weightSchema.optional(),
    gradeBoundaries: z.array(gradeBoundarySchema).min(1).max(20).optional(),
    remarks: z.string().trim().min(1).max(1000).optional(),
    effectiveFrom: z.coerce.date().optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "At least one field must be provided"
  })
  .superRefine((value, ctx) => {
    const weights = [value.ca1Weight, value.ca2Weight, value.examWeight].filter((entry): entry is number => entry !== undefined);

    if (weights.length > 0 && weights.length !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All three weights must be updated together",
        path: ["ca1Weight"]
      });
    }

    if (weights.length === 3) {
      const weightTotal = Math.round((value.ca1Weight! + value.ca2Weight! + value.examWeight!) * 1000) / 1000;

      if (weightTotal !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weights must total exactly 100",
          path: ["ca1Weight"]
        });
      }
    }

    if (value.gradeBoundaries) {
      assertBoundaryCoverage(value.gradeBoundaries, ctx);
    }
  });

export const gradingPolicyIdParamsSchema = z.object({
  policyId: idSchema
});

export const listGradingPoliciesQuerySchema = z.object({}).passthrough();

export const createGradingPolicyRequestSchema = createGradingPolicySchema;
export const updateGradingPolicyRequestSchema = updateGradingPolicySchema;

export function parseGradingPolicyBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseGradingPolicyQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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
