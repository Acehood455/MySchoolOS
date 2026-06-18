import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RootRouteView } from "./root-view.js";

test("renders the root route shell", () => {
  const html = renderToStaticMarkup(
    <RootRouteView
      apiBaseUrl="http://localhost:3000"
      healthStatus="ok"
      onRefresh={() => {
        /* no-op */
      }}
    />
  );

  assert.match(html, /Foundation bootstrap is live\./);
  assert.match(html, /Vite \+ React/);
  assert.match(html, />ok</);
  assert.match(html, /href="http:\/\/localhost:3000"/);
  assert.match(html, /Refresh health/);
});
