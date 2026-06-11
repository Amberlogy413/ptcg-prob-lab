import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL auto-cleanup only registers itself when test globals exist; we run
// Vitest without globals, so register it explicitly.
afterEach(() => {
  cleanup();
});
