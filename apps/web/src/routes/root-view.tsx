import React from "react";
import { Button } from "../../../../packages/ui/src/index.js";

export type RootRouteViewProps = {
  apiBaseUrl: string;
  healthStatus: string;
  healthErrorMessage?: string;
  onRefresh: () => void;
};

export function RootRouteView({
  apiBaseUrl,
  healthStatus,
  healthErrorMessage,
  onRefresh
}: RootRouteViewProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-sky-700">
          MySchoolOS
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
          Foundation bootstrap is live.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          The frontend shell, shared packages, environment handling, and API
          health wiring are in place for the first bootstrap pass.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Frontend</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">Vite + React</p>
          </section>

          <section className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">API</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{healthStatus}</p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={onRefresh}>Refresh health</Button>
          <a
            className="text-sm font-medium text-sky-700 underline underline-offset-4"
            href={apiBaseUrl}
          >
            API base
          </a>
        </div>

        {healthErrorMessage ? (
          <p className="mt-4 text-sm text-rose-600">{healthErrorMessage}</p>
        ) : null}
      </div>
    </main>
  );
}
