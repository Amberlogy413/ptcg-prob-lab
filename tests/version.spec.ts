/**
 * The TopNav version tag (docs/07 §3, Phase 2) must show the real build version.
 * Pin APP_VERSION to package.json so the displayed "· V…" can never drift —
 * same spirit as the golden-count footer guard.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { APP_VERSION } from "../src/constants.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };

describe("APP_VERSION", () => {
  it("matches package.json version exactly", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
