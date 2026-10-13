// Browser port of Vease's node_scripts/cloud_load.js: starts a cloud Vease instance and loads a
// Data file into it through the Vease controller.

// Third party imports
import { $fetch } from "ofetch";
import cloud_api_schemas from "@geode/cloud-api/cloud_api_typed_schemas.js";
import vease_schemas from "vease/vease_typed_schemas.js";
import { fetchRaw } from "@ogw_shared/utils/fetch_raw";
import { fetchSchema } from "@ogw_shared/utils/fetch_schema";
import { getIsAppReady } from "@ogw_shared/scripts";
import type { ResponseOf } from "@ogw_shared/utils/types";

// Local imports
import { BRANCH, CLOUD_API_URL, DATA_URL, FRONT_URL, PROJECT } from "@demo_shared/constants";

const run_schema = cloud_api_schemas.cloud_api.cloud.run;
const load_schema = vease_schemas.api.controller.data.load;
const MINUTE_MS = 60_000;
const READY_POLL_MS = 1000;

async function login(password: string): Promise<string> {
  const { idToken } = await $fetch<{ idToken: string }>("/api/login", {
    method: "POST",
    body: { password },
  });
  return idToken;
}

function downloadData(): Promise<Blob> {
  return $fetch(DATA_URL, { responseType: "blob" });
}

// Blocks until Cloud Run reports the instance ready and returns its bare host.
async function runInstance(idToken: string): Promise<string> {
  const { url } = (await fetchSchema({
    schema: run_schema,
    params: { project: PROJECT, branch: BRANCH },
    baseURL: CLOUD_API_URL,
    headers: { Authorization: `Bearer ${idToken}` },
    timeout: 5 * MINUTE_MS,
  })) as ResponseOf<typeof run_schema>;
  return url;
}

function frontUrl(host: string): string {
  return `${FRONT_URL}/?cloud_url=${host}`;
}

function appUrl(host: string): string {
  return `https://${host}/server`;
}

// The Vease tab marks the app ready once its back and viewer are connected.
async function waitForAppReady(url: string): Promise<void> {
  const deadline = Date.now() + 2 * MINUTE_MS;
  while (Date.now() < deadline) {
    const { isReady } = ((await getIsAppReady(url).catch(() => undefined)) ?? {}) as {
      isReady?: boolean;
    };
    if (isReady === true) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  throw new Error("Vease did not connect within 2 min");
}

// Multipart upload: fetchSchema would reject the FormData (Ajv sees its enumerable prototype
// Methods as additional properties), so only the route and method come from the schema.
async function loadData(url: string, file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  const { response } = (await fetchRaw({
    route: load_schema.$id,
    method: load_schema.methods[0],
    params: form,
    baseURL: url,
  })) as ResponseOf<typeof load_schema>;
  return `${response.name} (${response.geode_object_type})`;
}

export { appUrl, downloadData, frontUrl, loadData, login, runInstance, waitForAppReady };
