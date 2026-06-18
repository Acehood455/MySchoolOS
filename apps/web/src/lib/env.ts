import { z } from "zod";

const webEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default("MySchoolOS"),
  VITE_API_BASE_URL: z.string().url()
});

export type WebEnvironment = z.infer<typeof webEnvSchema>;

export function loadWebEnvironment(): WebEnvironment {
  return webEnvSchema.parse(import.meta.env);
}
