import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

const draft = { title: "Vorlesung", date: "2026-10-29", transcript: "Text" };

describe("recording dates", () => {
  it("rejects an invalid date on rename before it reaches the database", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "AT2", semester: "WiSe26-27" });
    const id = await w.services.recordings.create(alex, course.id, draft);

    await expect(w.services.recordings.rename(alex, id, { date: "not-a-date" })).rejects.toBeInstanceOf(ZodError);
    expect((await w.services.recordings.get(alex, id)).date).toBe(draft.date);
  });

  it("rejects a date that is not a real calendar day", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "CV", semester: "WiSe26-27" });
    await expect(w.services.recordings.create(alex, course.id, { ...draft, date: "2026-02-30" })).rejects.toBeInstanceOf(ZodError);
  });
});
