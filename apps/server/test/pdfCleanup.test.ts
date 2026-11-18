import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const { destroy } = vi.hoisted(() => ({ destroy: vi.fn(async () => {}) }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async () => { throw new Error("broken page"); },
      destroy,
    }),
  }),
}));
const { pdfPages } = await import("../src/text/pdf.ts");

describe("PDF extraction", () => {
  it("destroys the document even when a page cannot be read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sm-pdf-"));
    const file = join(dir, "broken.pdf");
    await writeFile(file, "%PDF");
    try {
      await expect(pdfPages(file)).rejects.toThrow("broken page");
      expect(destroy).toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
