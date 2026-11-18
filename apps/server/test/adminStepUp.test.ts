import type { Identity } from "../src/auth/identity.ts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

const as = (userId: string, over: Partial<Identity> = {}): Identity => ({
  userId,
  email: "",
  methods: ["password"],
  aal: "aal1",
  via: "session",
  authenticatedAt: new Date(),
  ...over,
});

describe("admin step-up", () => {
  it("does not let a password-only admin delete someone else's programme", async () => {
    const admin = await w.user("Admin", true);
    const owner = await w.user("Owner");
    const program = await w.services.programs.create(owner, { university: "TU", name: "CV", degree: "BSc", regulation: "PO 26" });

    await expect(w.services.programs.remove(as(admin), program)).rejects.toMatchObject({ code: "not_manager" });
    await expect(w.services.programs.remove(as(admin, { methods: ["password", "totp"], aal: "aal2" }), program)).resolves.toBeUndefined();
  });

  it("hides other profiles from a password-only admin", async () => {
    const admin = await w.user("Admin", true);
    const other = await w.user("Other");

    expect((await w.services.users.people(as(admin))).some((person) => person.id === other)).toBe(false);
    expect((await w.services.users.people(as(admin, { methods: ["passkey"] }))).some((person) => person.id === other)).toBe(true);
  });
});
