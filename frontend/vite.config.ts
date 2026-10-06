
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    routeRules: {
      '/api/**': { proxy: 'http://127.0.0.1:8080/api/**' }
    }
  }
});
