import { screen, waitFor } from "@testing-library/react";

/** Wait for the lazy-loaded workspace chunk to mount (Suspense fallback gone). */
export async function viewReady(): Promise<void> {
  await waitFor(() => {
    if (screen.queryByText("載入中…")) throw new Error("view chunk still loading");
  });
}
