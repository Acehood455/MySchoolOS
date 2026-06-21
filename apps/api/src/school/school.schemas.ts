import { z } from "zod";
import { AppError, normalizeRequestHost } from "@myschoolos/shared";

const colorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected a hex color");

const hostSchema = z.string().trim().min(1).max(253).superRefine((value, ctx) => {
  if (!normalizeRequestHost(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected a valid host"
    });
  }
});

export const createSchoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160).optional(),
  code: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const updateSchoolSchema = createSchoolSchema.partial().extend({
  metadata: z.record(z.unknown()).optional()
});

export const updateSchoolSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  locale: z.string().trim().min(2).max(20),
  academicSessionDefaults: z.record(z.unknown()),
  platformConfiguration: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional()
});

export const updateSchoolThemeSchema = z.object({
  logo: z.string().trim().min(1).max(2048),
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  brandingConfiguration: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional()
});

export const addSchoolDomainSchema = z.object({
  host: hostSchema,
  hostType: z.enum(["custom_domain", "subdomain"]),
  subdomain: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const verifySchoolDomainSchema = z.object({
  verifiedBy: z.string().trim().min(1),
  metadata: z.record(z.unknown()).optional()
});

export const createSchoolRequestSchema = createSchoolSchema;
export const updateSchoolRequestSchema = updateSchoolSchema;
export const updateSchoolSettingsRequestSchema = updateSchoolSettingsSchema;
export const updateSchoolThemeRequestSchema = updateSchoolThemeSchema;
export const addSchoolDomainRequestSchema = addSchoolDomainSchema;
export const verifySchoolDomainRequestSchema = verifySchoolDomainSchema;

export function parseSchoolBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

