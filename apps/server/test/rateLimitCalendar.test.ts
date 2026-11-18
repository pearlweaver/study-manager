import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, LIMITS } from "../src/http/app.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("calendar subscription rate limit", () => {
  it("has its own bucket, separate from other unauthenticated traffic", async () => {
    const app = await buildApp(w.services);
    for (let i = 0; i < LIMITS.calendar + 5; i++) await app.inject({ url: "/api/programs" });

    const response = await app.inject({ url: "/ical/unknown.ics" });
    expect(response.statusCode).not.toBe(429);
    await app.close();
  });
});
