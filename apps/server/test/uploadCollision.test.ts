import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("uploads of the same file name", () => {
  it("keep both files with their own content", async () => {
    const alex = await w.user("Alex");

    for (let i = 0; i < 8; i++) {
      const course = await w.services.courses.create(alex, { title: `AT2 ${i}`, semester: "WiSe26-27" });
      const results = await Promise.allSettled([
        w.services.files.upload(alex, course.id, "skripte", await w.upload("script.pdf", "first")),
        w.services.files.upload(alex, course.id, "skripte", await w.upload("script.pdf", "second")),
      ]);

      expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
      const listed = await w.services.files.list(alex, course.id);
      expect(listed.map((file) => file.name).sort()).toEqual(["script (2).pdf", "script.pdf"]);
      const contents = await Promise.all(listed.map(async (file) => readFile((await w.services.files.open(alex, file.id)).path, "utf8")));
      expect(contents.sort()).toEqual(["first", "second"]);
    }
  });
});
