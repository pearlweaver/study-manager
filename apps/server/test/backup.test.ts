import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runBackup } from "../src/jobs/backup.ts";

describe("backups", () => {
  let dir: string;
  let previous: Record<string, string | undefined>;

  beforeAll(async () => {
    previous = {
      BACKUP_DIR: process.env.BACKUP_DIR,
      FILES_DIR: process.env.FILES_DIR,
      BACKUP_PASSPHRASE: process.env.BACKUP_PASSPHRASE,
    };
    dir = await mkdtemp(join(tmpdir(), "sm-backups-"));
    const files = await mkdtemp(join(tmpdir(), "sm-files-"));
    await writeFile(join(files, "one.txt"), "hello");
    process.env.BACKUP_DIR = dir;
    process.env.FILES_DIR = files;
    process.env.BACKUP_PASSPHRASE = "test-passphrase";
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("keeps two backups started in the same minute", async () => {
    const now = new Date("2026-11-20T03:30:10.000Z");
    const first = await runBackup(now);
    const second = await runBackup(now);
    const names = [...first.files, ...second.files].map((file) => file.name);
    expect(new Set(names).size).toBe(4);
  });
});
