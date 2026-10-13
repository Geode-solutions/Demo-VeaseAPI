// Node imports
import path from "node:path";

// Third party imports
import { searchForWorkspaceRoot } from "vite";

const __dirname = import.meta.dirname;

// oxlint-disable-next-line import/no-default-export
export default defineNuxtConfig({
  extends: ["@geode/opengeodeweb-front"],

  runtimeConfig: {
    // Server-only, overridden by NUXT_DEMO_PASSWORD, NUXT_GEODE_USER_EMAIL and NUXT_GEODE_USER_PASSWORD.
    // An unset demo password rejects every login.
    demoPassword: "",
    geodeUserEmail: "",
    geodeUserPassword: "",
  },

  alias: {
    "@demo": path.resolve(__dirname, "app"),
    "@demo_shared": path.resolve(__dirname, "shared"),
  },

  imports: {
    scan: false,
  },

  modules: ["vuetify-nuxt-module"],

  // OGWFront's own routes serve local and cloud Vease apps, not this demo
  nitro: {
    ignore: ["api/cloud/**", "api/local/**", "api/microservice/**"],
  },

  ssr: false,

  vuetify: {
    vuetifyOptions: {
      theme: {
        defaultTheme: "dark",
        themes: {
          dark: {
            dark: true,
            colors: {
              primary: "#3c9983",
              secondary: "#3c9983",
              background: "#0a0f0e",
              surface: "#121817",
            },
          },
        },
      },
    },
  },

  app: {
    head: {
      title: "Vease API demo",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
    },
  },

  vite: {
    server: {
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd())],
      },
    },
  },

  compatibilityDate: "2025-03-27",
});
