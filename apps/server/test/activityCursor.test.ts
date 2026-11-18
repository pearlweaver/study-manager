import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activity } from "../src/db/schema.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("activity history", () => {
  it("does not skip entries that share a timestamp", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "AT2", semester: "WiSe26-27" });
    const at = new Date("2030-01-01T10:00:00Z");
    await w.db.insert(activity).values(
      [0, 1, 2].map((n) => ({ courseId: course.id, actorId: alex, via: "app", action: "course.changed", subject: `entry ${n}`, at })),
    );

    const first = await w.services.activity.ofCourse(alex, course.id, { limit: 2 });
    expect(first).toHaveLength(2);
    const older = await w.services.activity.ofCourse(alex, course.id, { limit: 2, before: first[1]!.id });
    const seen = [...first, ...older].map((entry) => entry.subject).filter((subject) => subject.startsWith("entry "));
    expect(seen.sort()).toEqual(["entry 0", "entry 1", "entry 2"]);
  });
});
