import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { receiveUploads } from "../src/http/uploads.ts";

const parts = () =>
  (async function* () {
    for (const content of ["aaa", "bbb", "ccc"]) {
      const file = Readable.from([Buffer.from(content)]) as Readable & { truncated?: boolean };
      file.truncated = false;
      yield { file, filename: `${content}.pdf`, mimetype: "application/pdf" };
    }
  })();

describe("upload size budget", () => {
  it("rejects a request whose parts together exceed the budget", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sm-uploads-"));
    const request = { isMultipart: () => true, files: parts };
    try {
      await expect(receiveUploads(request as never, dir, 4)).rejects.toMatchObject({ status: 413 });
      expect(await readdir(join(dir, ".tmp"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
