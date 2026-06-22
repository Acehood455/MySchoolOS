import React from "react";
import { useQuery } from "@tanstack/react-query";
import { loadWebEnvironment, resolveApiBaseUrl } from "../lib/env.js";
import { fetchHealth } from "../lib/api.js";
import { RootRouteView } from "./root-view.js";

const env = loadWebEnvironment();
const apiBaseUrl = resolveApiBaseUrl(env);

export function RootRoute() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => fetchHealth(apiBaseUrl)
  });

  return (
    <RootRouteView
      apiBaseUrl={apiBaseUrl}
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
