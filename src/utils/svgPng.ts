/** Shared SVG → canvas → PNG download (extracted from resultCard.ts, P8.3). */

export async function downloadSvgPng(
  svg: string,
  width: number,
  height: number,
  filename: string,
): Promise<void> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg rasterize failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const cx = canvas.getContext("2d");
    if (!cx) throw new Error("no 2d context");
    cx.scale(2, 2);
    cx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("png encode failed");
    const dl = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = dl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dl);
  } finally {
    URL.revokeObjectURL(url);
  }
}
