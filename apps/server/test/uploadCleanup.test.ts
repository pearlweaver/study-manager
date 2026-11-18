import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/http/app.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

const boundary = "----study-test-boundary";
const multipart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="script.pdf"\r\nContent-Type: application/pdf\r\n\r\nhello\r\n--${boundary}--\r\n`;

describe("uploaded bytes", () => {
  it("are removed when the uploader is not allowed into the course", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "AT2", semester: "WiSe26-27" });
    const app = await buildApp(w.services);

    const response = await app.inject({
      method: "POST",
      url: `/api/courses/${course.id}/files`,
      headers: { authorization: `Bearer user:${lena}`, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart,
    });
    expect(response.statusCode).toBe(404);
    expect(await readdir(join(w.filesDir, ".tmp"))).toEqual([]);
  });
});
