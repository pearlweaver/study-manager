import { access } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { programsOf } from "../src/domain/programs.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("handbook uploads", () => {
  it("do not move the PDF when the database write fails", async () => {
    const manager = await w.user("Manager");
    const program = await w.services.programs.create(manager, { university: "TU", name: "CV", degree: "BSc", regulation: "" });
    const upload = (await w.upload("handbook.pdf", "%PDF")).tempPath;
    const failingDb = {
      query: w.db.query,
      update: () => { throw new Error("db down"); },
    } as never;

    await expect(programsOf(failingDb, w.filesDir).setHandbook(w.identity(manager), program, upload)).rejects.toThrow("db down");
    await expect(access(join(w.filesDir, "handbooks", `${program}.pdf`))).rejects.toThrow();
  });
});
