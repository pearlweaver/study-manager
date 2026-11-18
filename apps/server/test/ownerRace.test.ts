import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { courseMembers } from "../src/db/schema.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("course owners", () => {
  it("never leaves a course without an owner when two owners leave at once", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");

    for (let i = 0; i < 6; i++) {
      const course = await w.services.courses.create(alex, { title: `AT2 ${i}`, semester: "WiSe26-27" });
      await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
      await w.services.courses.setRole(alex, course.id, lena, "owner");

      const results = await Promise.allSettled([
        w.services.courses.removeMember(alex, course.id, lena),
        w.services.courses.removeMember(lena, course.id, alex),
      ]);

      const owners = await w.db
        .select({ id: courseMembers.userId })
        .from(courseMembers)
        .where(and(eq(courseMembers.courseId, course.id), eq(courseMembers.role, "owner")));
      expect(owners).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    }
  });
});
