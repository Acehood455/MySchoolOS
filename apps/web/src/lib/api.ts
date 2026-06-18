import type { HealthResponse } from "@myschoolos/shared";

export async function fetchHealth(apiBaseUrl: string): Promise<HealthResponse> {
  const response = await fetch(new URL("/health", apiBaseUrl), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
