import { describe, expect, it, vi } from "vitest";

const sent: { name: string; options?: Record<string, unknown> }[] = [];
vi.mock("pg-boss", () => ({
  default: class {
    on() {}
    async start() {}
    async createQueue() {}
    async schedule() {}
    async work() {}
    async send(name: string, _data: unknown, options?: Record<string, unknown>) {
      sent.push({ name, options });
      return null;
    }
  },
}));

const { startScheduler } = await import("../src/jobs/scheduler.ts");

describe("startup jobs", () => {
  it("are singletons so replicas do not repeat them", async () => {
    const log = { error() {}, info() {} } as never;
    const services = {
      search: { pending: async () => [] },
      calendar: { refreshAll: async () => {} },
      files: { purge: async () => 0 },
      activity: { prune: async () => 0 },
    } as never;
    await startScheduler("postgres://unused", services, log);

    expect(sent.map((job) => job.name)).toEqual(["feeds-refresh", "index-missing"]);
    expect(sent.map((job) => job.options)).toEqual([{ singletonKey: "startup-feeds" }, { singletonKey: "startup-index" }]);
  });
});
