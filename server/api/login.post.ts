// Third party imports
import { createError, defineEventHandler, readBody } from "h3";
import { useRuntimeConfig } from "#imports";

// Local imports
import { CLOUD_API_URL } from "@demo_shared/constants";

interface LoginBody {
  password?: unknown;
}

// Checks the demo password, then logs in to the Cloud API with the server-side Geode account.
// Only the ID token reaches the browser, which needs it to start the instance itself
// (the run call lasts minutes, longer than a Netlify function may).
export default defineEventHandler(async (event): Promise<{ idToken: string }> => {
  const { demoPassword, geodeUserEmail, geodeUserPassword } = useRuntimeConfig(event);
  const { password } = (await readBody<LoginBody>(event)) ?? {};
  if (demoPassword === "" || password !== demoPassword) {
    throw createError({ statusCode: 401, statusMessage: "Wrong password" });
  }
  if (geodeUserEmail === "" || geodeUserPassword === "") {
    throw createError({ statusCode: 500, statusMessage: "Geode account is not configured" });
  }
  const response = await fetch(`${CLOUD_API_URL}/cloud_api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: geodeUserEmail, password: geodeUserPassword }),
  });
  const json: unknown = await response.json().catch(() => undefined);
  const idToken =
    typeof json === "object" && json !== null && "idToken" in json ? json.idToken : undefined;
  if (!response.ok || typeof idToken !== "string") {
    throw createError({ statusCode: 502, statusMessage: `Cloud login failed (HTTP ${response.status})` });
  }
  return { idToken };
});
