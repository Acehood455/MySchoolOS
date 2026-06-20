import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const values = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) {
        values[key] = value;
      }
    }

    return values;
  } catch {
    return {};
  }
}

const apiEnv = {
  ...process.env,
  ...loadDotEnv(path.join(rootDir, ".env"))
};
const webEnv = {
  ...process.env
};

const children = [];
let shuttingDown = false;

function startProcess(label, args) {
  const env = label === "api" ? apiEnv : webEnv;
  const child = process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], {
        cwd: rootDir,
        env,
        stdio: ["ignore", "pipe", "pipe"]
      })
    : spawn("npm", args, {
      cwd: rootDir,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0) {
      return;
    }

    shuttingDown = true;
    for (const other of children) {
      if (other !== child && !other.killed) {
        other.kill();
      }
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    console.error(`[dev] ${label} exited with ${reason}`);
    process.exitCode = code ?? 1;
  });

  children.push(child);
  return child;
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[dev] starting API and web apps");
startProcess("api", ["run", "dev", "--workspace", "@myschoolos/api"]);

setTimeout(() => {
  startProcess("web", ["run", "dev", "--workspace", "@myschoolos/web"]);
}, 1000);
