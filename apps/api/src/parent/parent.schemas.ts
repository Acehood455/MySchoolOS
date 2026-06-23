import { AppError } from "@myschoolos/shared";
import { z } from "zod";

const metadataSchema = z.record(z.unknown()).optional();

const nameSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z][A-Za-z' -]*$/, "Expected a valid name");
const middleNameSchema = nameSchema.optional();
const emailSchema = z.string().trim().email().max(254).optional();
const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^[+]?[\d\s().-]+$/, "Expected a valid phone number")
  .optional();
const addressSchema = z.string().trim().min(1).max(255).optional();
const occupationSchema = z.string().trim().min(1).max(120).optional();

export const parentRelationshipTypeSchema = z.enum(["father", "mother", "guardian", "sponsor", "other"]);
export const parentStatusSchema = z.enum(["active", "inactive", "archived"]);
export const parentLinkStatusSchema = z.enum(["active", "archived"]);

export const createParentSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  middleName: middleNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  address: addressSchema,
  occupation: occupationSchema,
  relationshipType: parentRelationshipTypeSchema,
  metadata: metadataSchema
});

export const updateParentSchema = createParentSchema.partial().extend({
  status: parentStatusSchema.optional(),
  metadata: metadataSchema
});

export const parentListQuerySchema = z.object({
  status: parentStatusSchema.optional()
});

export const createParentRequestSchema = createParentSchema;
export const updateParentRequestSchema = updateParentSchema;

export function parseParentBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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

export function parseParentQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, query: unknown, code: string): z.infer<TSchema> {
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

