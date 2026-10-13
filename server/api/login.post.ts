// Third party imports
import { createError, defineEventHandler, readBody } from "h3";
import { consola } from "consola";
import { useRuntimeConfig } from "#imports";
import cloud_api_schemas from "@geode/cloud-api/cloud_api_typed_schemas.js";
import { fetchSchema } from "@ogw_shared/utils/fetch_schema";
import type { ResponseOf } from "@ogw_shared/utils/types";

// Local imports
import { CLOUD_API_URL } from "@demo_shared/constants";

const login_schema = cloud_api_schemas.cloud_api.auth.login;

// Checks the demo password, then logs in to the Cloud API with the server-side Geode account.
// Only the ID token reaches the browser, which starts the instance itself
// (the run call lasts minutes, longer than a Netlify function may).
export default defineEventHandler(async (event): Promise<{ idToken: string }> => {
  const { demoPassword, geodeUserEmail, geodeUserPassword } = useRuntimeConfig(event);
  const { password } = (await readBody<{ password?: string } | undefined>(event)) ?? {};
  if (demoPassword === "" || password !== String(demoPassword)) {
    throw createError({ statusCode: 401, statusMessage: "Wrong password" });
  }
  if (geodeUserEmail === "" || geodeUserPassword === "") {
    throw createError({ statusCode: 500, statusMessage: "Geode account is not configured" });
  }
  try {
    // Nuxt parses env overrides, so an all-digit password would arrive as a number
    const { idToken } = (await fetchSchema({
      schema: login_schema,
      params: { email: String(geodeUserEmail), password: String(geodeUserPassword) },
      baseURL: CLOUD_API_URL,
    })) as ResponseOf<typeof login_schema>;
    return { idToken };
  } catch (error) {
    consola.error("Cloud login failed", error);
    throw createError({ statusCode: 502, statusMessage: "Cloud login failed" });
  }
});
