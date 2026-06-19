import type { AuthCookieSettings } from "@myschoolos/shared";

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((accumulator, part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      return accumulator;
    }

    const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());

    if (key) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

export function serializeSessionCookie(value: string, settings: AuthCookieSettings, maxAgeSeconds: number): string {
  const parts = [
    `${settings.name}=${encodeURIComponent(value)}`,
    `Path=${settings.path ?? "/"}`,
    "HttpOnly",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    `SameSite=${settings.sameSite ?? "lax"}`
  ];

  if (settings.domain) {
    parts.push(`Domain=${settings.domain}`);
  }

  if (settings.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearSessionCookie(settings: AuthCookieSettings): string {
  const parts = [`${settings.name}=`, `Path=${settings.path ?? "/"}`, "HttpOnly", "Max-Age=0", `SameSite=${settings.sameSite ?? "lax"}`];

  if (settings.domain) {
    parts.push(`Domain=${settings.domain}`);
  }

  if (settings.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
