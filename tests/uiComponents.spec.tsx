/**
 * Design-system components (docs/07_DESIGN_SYSTEM.md Phase 1): OptionCard,
 * HintBar, Stepper — the borrowed-from-PriceRight expression system, neutral
 * graphite only.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionCard, OptionGrid } from "../src/components/ui/OptionCard.tsx";
import { HintBar } from "../src/components/ui/HintBar.tsx";
import { Stepper } from "../src/components/ui/Stepper.tsx";

describe("OptionCard", () => {
  it("renders badge + title + ｜-joined subline and fires onSelect", () => {
    const onSelect = vi.fn();
    render(
      <OptionGrid>
        <OptionCard
          selected={false}
          onSelect={onSelect}
          icon={<svg />}
          badge="01"
          title="賽前無條件"
          subline={["未看牌前", "全局期望"]}
        />
      </OptionGrid>,
    );
    const btn = screen.getByRole("button", { name: /賽前無條件/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("未看牌前 ｜ 全局期望")).toBeTruthy();
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("marks the selected card via aria-pressed", () => {
    render(<OptionCard selected onSelect={() => {}} icon={<svg />} title="已知手牌" />);
    expect(screen.getByRole("button", { name: /已知手牌/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("HintBar", () => {
  it("uses alert role for blocking and note for others", () => {
    const { rerender } = render(<HintBar variant="blocking">仲差以下項目</HintBar>);
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<HintBar variant="neutral">說明</HintBar>);
    expect(screen.getByRole("note")).toBeTruthy();
  });
});

describe("Stepper", () => {
  const steps = [
    { id: 1, label: "揀牌組", subline: "來源" },
    { id: 2, label: "設條件", subline: "句式" },
    { id: 3, label: "結果", subline: "概率 ｜ 收據" },
  ];
  it("locks steps beyond maxStep and jumps to done steps", () => {
    const onJump = vi.fn();
    render(<Stepper steps={steps} current={2} maxStep={2} onJump={onJump} />);
    // step 3 (>maxStep) is locked → disabled, no jump
    const s3 = screen.getByRole("button", { name: /結果/ });
    expect(s3).toBeDisabled();
    fireEvent.click(s3);
    expect(onJump).not.toHaveBeenCalled();
    // step 1 (done) jumps
    fireEvent.click(screen.getByRole("button", { name: /揀牌組/ }));
    expect(onJump).toHaveBeenCalledWith(1);
  });
});
