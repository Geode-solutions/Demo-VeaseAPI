<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { FetchError } from "ofetch";

import GlassCard from "@ogw_front/components/GlassCard.vue";

import { DATA_FILENAME } from "@demo_shared/constants";
import {
  appUrl,
  downloadData,
  frontUrl,
  loadData,
  login,
  runInstance,
  waitForAppReady,
} from "@demo/utils/workflow";

const STEPS = [
  "Log in",
  "Start a Vease instance (a few minutes)",
  "Wait for Vease to connect",
  `Load ${DATA_FILENAME}`,
];

const password = ref("");
const passwordError = ref("");
const submitting = ref(false);
const authenticated = ref(false);
// Index of the running step, STEPS.length once all are done
const current = ref(0);
const error = ref("");
const veaseUrl = ref("");
const loaded = ref("");

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

const STEP_MARKS = { done: "✓", running: "…", failed: "✗", pending: "○" };

function stepState(index: number): keyof typeof STEP_MARKS {
  if (index < current.value) {
    return "done";
  }
  if (index > current.value) {
    return "pending";
  }
  return error.value ? "failed" : "running";
}

// Opened within the Start click, the only moment browsers let a page open a tab. It shows the
// Progress until the instance is online, then becomes Vease.
function openProgressTab(): Window | null {
  const tab = globalThis.open("", "_blank");
  if (!tab) {
    return tab;
  }
  tab.document.title = "Starting Vease…";
  tab.document.body.style.cssText =
    "font-family:sans-serif;background:#0a0f0e;color:#eee;display:grid;place-content:center;min-height:100vh;margin:0";
  const list = tab.document.createElement("ul");
  list.style.cssText = "list-style:none;font-size:1.2rem;line-height:2";
  tab.document.body.append(list);
  watchEffect(() => {
    if (tab.closed || veaseUrl.value) {
      return;
    }
    list.replaceChildren(
      ...STEPS.map((title, index) => {
        const item = tab.document.createElement("li");
        item.textContent = `${STEP_MARKS[stepState(index)]} ${title}`;
        return item;
      }),
    );
    if (error.value) {
      const item = tab.document.createElement("li");
      item.style.color = "#ff5252";
      item.textContent = error.value;
      list.append(item);
    }
  });
  return tab;
}

// Downloads while the visitor types the password
const data = downloadData();
data.catch((caught: unknown) => {
  error.value = `Download ${DATA_FILENAME}: ${errorMessage(caught)}`;
});

async function runWorkflow(idToken: string, tab: Window | null): Promise<void> {
  current.value = 1;
  const host = await runInstance(idToken);
  veaseUrl.value = frontUrl(host);
  if (tab && !tab.closed) {
    tab.location.href = veaseUrl.value;
  }
  current.value = 2;
  await waitForAppReady(appUrl(host));
  current.value = 3;
  loaded.value = await loadData(appUrl(host), await data, DATA_FILENAME);
  current.value = STEPS.length;
}

async function submit(): Promise<void> {
  submitting.value = true;
  passwordError.value = "";
  const tab = openProgressTab();
  try {
    const idToken = await login(password.value);
    authenticated.value = true;
    await runWorkflow(idToken, tab);
  } catch (caught) {
    if (authenticated.value) {
      error.value = `${STEPS[current.value]}: ${errorMessage(caught)}`;
    } else {
      tab?.close();
      passwordError.value =
        caught instanceof FetchError && caught.statusCode === 401
          ? "Wrong password"
          : errorMessage(caught);
    }
  } finally {
    submitting.value = false;
  }
}

function stepIcon(index: number): { icon: string; color: string } {
  if (index < current.value) {
    return { icon: "mdi-check-circle", color: "success" };
  }
  if (index === current.value && error.value) {
    return { icon: "mdi-alert-circle", color: "error" };
  }
  return { icon: "mdi-circle-outline", color: "grey" };
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
            <v-list-item v-for="(title, index) in STEPS" :key="title" :title="title">
              <template #prepend>
                <v-progress-circular
                  v-if="index === current && !error && authenticated"
                  indeterminate
                  size="24"
                  width="3"
                  color="primary"
                  class="mr-8"
                />
                <v-icon v-else v-bind="stepIcon(index)" />
              </template>
            </v-list-item>
          </v-list>
        </GlassCard>

        <v-alert v-if="error" type="error" class="mt-4" :text="error" />
        <v-alert v-if="loaded" type="success" class="mt-4" :text="`Loaded ${loaded}`" />
      </v-container>
    </v-main>

    <v-overlay
      :model-value="!authenticated"
      persistent
      class="align-center justify-center"
      opacity="0.85"
    >
      <GlassCard variant="ui" style="width: min(400px, calc(100vw - 32px))">
        <v-form @submit.prevent="submit">
          <h2 class="text-h6 mb-2">Restricted demo</h2>
          <p class="text-medium-emphasis mb-4">Enter the password to start the demo.</p>
          <v-alert v-if="error" type="error" density="compact" class="mb-4" :text="error" />
          <v-text-field
            v-model="password"
            type="password"
            label="Password"
            autofocus
            :error-messages="passwordError"
            :disabled="submitting"
          />
          <v-btn
            type="submit"
            color="primary"
            block
            :loading="submitting"
            :disabled="password === '' || error !== ''"
            text="Start"
          />
        </v-form>
      </GlassCard>
    </v-overlay>
  </v-app>
</template>
