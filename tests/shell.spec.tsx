/**
 * Phase 0 shell acceptance: top row shows the four workspaces, the footer
 * carries the fan-tool disclaimer and the 精確計算 badge (docs/06 Phase 0 DoD).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App.tsx";

describe("app shell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the four workspace tabs in zh-Hant", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    for (const label of ["牌組", "提問", "獎賞卡", "比較"]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it("renders the footer disclaimer and the exact-computation badge", () => {
    render(<App />);
    expect(screen.getByText("精確計算 · 非模擬")).toBeInTheDocument();
    expect(screen.getByText(/非官方粉絲專案/)).toBeInTheDocument();
    expect(screen.getByText(/27 案例 · 507 斷言/)).toBeInTheDocument();
  });
});
