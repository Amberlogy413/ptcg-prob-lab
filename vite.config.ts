/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Subpath hosting (GitHub Pages serves at /<repo>/): the deploy workflow
  // sets DEPLOY_BASE; local dev and root-hosted deploys stay at "/".
  base: process.env.DEPLOY_BASE ?? "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.spec.{ts,tsx}"],
    css: false,
  },
});
