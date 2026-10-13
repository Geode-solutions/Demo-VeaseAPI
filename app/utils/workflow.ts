// Browser port of Vease's node_scripts/cloud_load.js: starts a cloud Vease instance and loads a
// Data file into it through the Vease controller.

// Local imports
import { BRANCH, CLOUD_API_URL, DATA_URL, FRONT_URL, PROJECT } from "@demo_shared/constants";

interface LoadedData {
  id: string;
  name: string;
  geodeObjectType: string;
}

const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MILLISECONDS_IN_MINUTE = SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND;
const RUN_TIMEOUT_MINUTES = 5;
const READY_TIMEOUT_MINUTES = 2;
const READY_POLL_INTERVAL_MS = MILLISECONDS_IN_SECOND;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// Fetches a JSON response, turning network errors and non-2xx statuses into errors that name the
// Workflow step.
async function requestJson(step: string, url: string, init?: RequestInit): Promise<unknown> {
  let response: Response | undefined = undefined;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`${step}: request to ${url} failed (${errorMessage(error)})`, { cause: error });
  }
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${step}: HTTP ${response.status} ${body}`);
  }
  return JSON.parse(body);
}

// Reads a field of a JSON response, failing with the step name when it is missing.
function readField(step: string, json: unknown, key: string): unknown {
  const fields = new Map<string, unknown>(
    typeof json === "object" && json !== null ? Object.entries(json) : [],
  );
  const value = fields.get(key);
  if (value === undefined) {
    throw new Error(`${step}: no "${key}" in response ${JSON.stringify(json)}`);
  }
  return value;
}

function readString(step: string, json: unknown, key: string): string {
  const value = readField(step, json, key);
  if (typeof value !== "string") {
    throw new TypeError(`${step}: "${key}" is not a string in response ${JSON.stringify(json)}`);
  }
  return value;
}

const HTTP_UNAUTHORIZED = 401;

class WrongPasswordError extends Error {
  constructor() {
    super("Wrong password");
    this.name = "WrongPasswordError";
  }
}

async function login(password: string): Promise<string> {
  const step = "Login";
  try {
    const json = await requestJson(step, "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return readString(step, json, "idToken");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${step}: HTTP ${HTTP_UNAUTHORIZED}`)) {
      throw new WrongPasswordError();
    }
    throw error;
  }
}

async function downloadData(): Promise<Blob> {
  const step = "Download data";
  let response: Response | undefined = undefined;
  try {
    response = await fetch(DATA_URL);
  } catch (error) {
    throw new Error(`${step}: request to ${DATA_URL} failed (${errorMessage(error)})`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(`${step}: HTTP ${response.status}`);
  }
  return response.blob();
}

// Blocks until Cloud Run reports the instance ready and returns its bare host.
async function runInstance(idToken: string): Promise<string> {
  const step = "Run";
  const json = await requestJson(step, `${CLOUD_API_URL}/cloud_api/cloud/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ project: PROJECT, branch: BRANCH }),
    signal: AbortSignal.timeout(RUN_TIMEOUT_MINUTES * MILLISECONDS_IN_MINUTE),
  });
  return readString(step, json, "url");
}

function frontUrl(host: string): string {
  return `${FRONT_URL}/?cloud_url=${host}`;
}

function appUrl(host: string): string {
  return `https://${host}/server`;
}

async function isAppReady(url: string): Promise<boolean> {
  const step = "Wait for app ready";
  try {
    const json = await requestJson(step, `${url}/api/microservice/app/get_is_app_ready`);
    return readField(step, json, "isReady") === true;
  } catch {
    return false;
  }
}

// The Vease tab marks the app ready once its back and viewer are connected.
async function waitForAppReady(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MINUTES * MILLISECONDS_IN_MINUTE;
  while (!(await isAppReady(url))) {
    if (Date.now() > deadline) {
      throw new Error(`Wait for app ready: timed out after ${READY_TIMEOUT_MINUTES} min`);
    }
    await sleep(READY_POLL_INTERVAL_MS);
  }
}

async function loadData(url: string, file: Blob, filename: string): Promise<LoadedData> {
  const step = "Load data";
  const form = new FormData();
  form.append("file", file, filename);
  const json = await requestJson(step, `${url}/api/controller/data/load`, {
    method: "POST",
    body: form,
  });
  const data = readField(step, json, "response");
  return {
    id: readString(step, data, "id"),
    name: readString(step, data, "name"),
    geodeObjectType: readString(step, data, "geode_object_type"),
  };
}

export {
  appUrl,
  downloadData,
  errorMessage,
  frontUrl,
  loadData,
  login,
  runInstance,
  waitForAppReady,
  WrongPasswordError,
  type LoadedData,
};
