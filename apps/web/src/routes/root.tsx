import React from "react";
import { useQuery } from "@tanstack/react-query";
import { loadWebEnvironment } from "../lib/env.js";
import { fetchHealth } from "../lib/api.js";
import { RootRouteView } from "./root-view.js";

const env = loadWebEnvironment();

export function RootRoute() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => fetchHealth(env.VITE_API_BASE_URL)
  });

  return (
    <RootRouteView
      apiBaseUrl={env.VITE_API_BASE_URL}
      healthStatus={healthQuery.data?.status ?? "Checking..."}
      healthErrorMessage={
        healthQuery.error
          ? healthQuery.error instanceof Error
            ? healthQuery.error.message
            : "Health check failed"
          : undefined
      }
      onRefresh={() => void healthQuery.refetch()}
    />
  );
}
