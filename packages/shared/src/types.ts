export type EnvironmentMode = "development" | "test" | "production";

export interface AppEnvironment {
  NODE_ENV: EnvironmentMode;
  APP_NAME: string;
  APP_URL: string;
  API_URL: string;
  DEFAULT_TIMEZONE: string;
  LOG_LEVEL: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
  database?: "connected" | "unavailable";
}
