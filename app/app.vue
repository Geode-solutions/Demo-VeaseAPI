<script setup lang="ts">
import { ref } from "vue";

import GlassCard from "@ogw_front/components/GlassCard.vue";

import { DATA_FILENAME } from "@demo_shared/constants";
import {
  type LoadedData,
  WrongPasswordError,
  appUrl,
  downloadData,
  errorMessage,
  frontUrl,
  loadData,
  login,
  runInstance,
  waitForAppReady,
} from "@demo/utils/workflow";

type StepStatus = "pending" | "running" | "done" | "error";

interface Step {
  key: string;
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { key: "download", title: "Download data", subtitle: DATA_FILENAME },
  { key: "login", title: "Log in", subtitle: "Geode cloud account" },
  { key: "run", title: "Start a Vease instance", subtitle: "This can take a few minutes" },
  { key: "ready", title: "Wait for Vease to connect", subtitle: "In the Vease tab" },
  { key: "load", title: "Load data", subtitle: "Through the Vease controller" },
];

const STATUS_ICONS: Record<StepStatus, { icon: string; color: string }> = {
  pending: { icon: "mdi-circle-outline", color: "grey" },
  running: { icon: "", color: "primary" },
  done: { icon: "mdi-check-circle", color: "success" },
  error: { icon: "mdi-alert-circle", color: "error" },
};

const password = ref("");
const passwordError = ref("");
const authenticated = ref(false);
const submitting = ref(false);
const statuses = ref<Record<string, StepStatus>>(
  Object.fromEntries(STEPS.map((step) => [step.key, "pending"])),
);
const workflowError = ref("");
const veaseUrl = ref("");
const loaded = ref<LoadedData | undefined>(undefined);

// Starts as soon as the page opens, while the visitor types the password.
let dataPromise: Promise<Blob> | undefined = undefined;
function startDownload(): Promise<Blob> {
  statuses.value.download = "running";
  dataPromise = downloadData().then(
    (blob) => {
      statuses.value.download = "done";
      return blob;
    },
    (error: unknown) => {
      statuses.value.download = "error";
      throw error;
    },
  );
  // Surfaced when the workflow awaits it, not as an unhandled rejection before that.
  dataPromise.catch(() => undefined);
  return dataPromise;
}
startDownload();

async function step<T>(key: string, action: () => Promise<T>): Promise<T> {
  statuses.value[key] = "running";
  try {
    const result = await action();
    statuses.value[key] = "done";
    return result;
  } catch (error) {
    statuses.value[key] = "error";
    throw error;
  }
}

function openPlaceholderTab(): Window | null {
  const tab = globalThis.open("", "_blank");
  tab?.document.write("<title>Vease</title><p style='font-family:sans-serif'>Starting Vease…</p>");
  return tab;
}

async function runWorkflow(idToken: string, tab: Window | null): Promise<void> {
  const host = await step("run", () => runInstance(idToken));
  veaseUrl.value = frontUrl(host);
  if (tab && !tab.closed) {
    tab.location.href = veaseUrl.value;
  }
  const url = appUrl(host);
  await step("ready", () => waitForAppReady(url));
  const data = await (dataPromise ?? startDownload());
  loaded.value = await step("load", () => loadData(url, data, DATA_FILENAME));
}

// The Vease tab is opened within the click so that popup blockers let it through,
// Then pointed at the instance once it is running.
async function submit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  passwordError.value = "";
  const tab = openPlaceholderTab();
  let idToken = "";
  try {
    idToken = await login(password.value);
  } catch (error) {
    tab?.close();
    passwordError.value =
      error instanceof WrongPasswordError ? error.message : errorMessage(error);
    return;
  } finally {
    submitting.value = false;
  }
  authenticated.value = true;
  statuses.value.login = "done";
  try {
    await runWorkflow(idToken, tab);
  } catch (error) {
    workflowError.value = errorMessage(error);
  }
}
</script>

<template>
  <v-app>
    <v-main class="d-flex align-center justify-center">
      <v-container style="max-width: 640px">
        <h1 class="text-h4 mb-2">Vease API demo</h1>
        <p class="text-medium-emphasis mb-6">
          Starts a Vease instance in the cloud, opens it in a new tab and loads
          <code>{{ DATA_FILENAME }}</code> into it through the Vease API.
        </p>

        <GlassCard variant="ui" padding="pa-2">
          <v-list bg-color="transparent">
            <v-list-item
              v-for="item in STEPS"
              :key="item.key"
              :title="item.title"
              :subtitle="item.subtitle"
            >
              <template #prepend>
                <v-progress-circular
                  v-if="statuses[item.key] === 'running'"
                  indeterminate
                  size="24"
                  width="3"
                  color="primary"
                  class="mr-8"
                />
                <v-icon
                  v-else
                  :icon="STATUS_ICONS[statuses[item.key] ?? 'pending'].icon"
                  :color="STATUS_ICONS[statuses[item.key] ?? 'pending'].color"
                />
              </template>
            </v-list-item>
          </v-list>
        </GlassCard>

        <v-alert v-if="workflowError" type="error" class="mt-4" :text="workflowError" />

        <v-alert v-if="loaded" type="success" class="mt-4" title="Data loaded">
          {{ loaded.name }} ({{ loaded.geodeObjectType }}) — id {{ loaded.id }}
        </v-alert>

        <v-btn
          v-if="veaseUrl"
          :href="veaseUrl"
          target="_blank"
          color="primary"
          class="mt-4"
          append-icon="mdi-open-in-new"
          text="Open Vease"
        />
      </v-container>
    </v-main>

    <v-overlay
      :model-value="!authenticated"
      persistent
      class="align-center justify-center"
      scrim="black"
      opacity="0.85"
    >
      <GlassCard variant="ui" style="width: min(400px, calc(100vw - 32px))">
        <v-form @submit.prevent="submit">
          <h2 class="text-h6 mb-2">Restricted demo</h2>
          <p class="text-medium-emphasis mb-4">Enter the password to start the demo.</p>
          <v-text-field
            v-model="password"
            type="password"
            label="Password"
            autofocus
            autocomplete="current-password"
            :error-messages="passwordError"
            :disabled="submitting"
          />
          <v-btn
            type="submit"
            color="primary"
            block
            :loading="submitting"
            :disabled="password === ''"
            text="Start"
          />
        </v-form>
      </GlassCard>
    </v-overlay>
  </v-app>
</template>
