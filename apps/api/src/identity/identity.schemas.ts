import { z } from "zod";
import { AppError } from "@myschoolos/shared";

const loginIdentifierSchema = z.string().trim().min(3).max(254);
const displayNameSchema = z.string().trim().min(2).max(120);
const metadataSchema = z.record(z.unknown()).optional();

export const identityCanonicalRoleSchema = z.enum(["super_admin", "school_admin", "teacher", "parent", "student"]);

export const createUserSchema = z.object({
  loginIdentifier: loginIdentifierSchema,
  displayName: displayNameSchema,
  metadata: metadataSchema
});

export const inviteUserSchema = z.object({
  loginIdentifier: loginIdentifierSchema,
  displayName: displayNameSchema,
  metadata: metadataSchema
});

export const resendInvitationSchema = z.object({
  metadata: metadataSchema
});

export const userLifecycleSchema = z.object({
  metadata: metadataSchema
});

export const roleAssignmentSchema = z.object({
  canonicalRole: identityCanonicalRoleSchema,
  metadata: metadataSchema
});

export function parseIdentityBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown, code: string): z.infer<TSchema> {
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
