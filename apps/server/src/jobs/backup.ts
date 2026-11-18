// Nightly backups: a dump of the database and an archive of the files, both
// encrypted with the backup passphrase. Until Google Drive is connected they
// stay on the server; 30 days are kept.
//
// Restore:
//   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in db-….dump.enc | pg_restore -d …
//   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in files-….tar.gz.enc | tar xz -C …
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

export const KEEP_DAYS = 30;

const backupDir = () => process.env.BACKUP_DIR ?? "/data/backups";

function run(script: string, env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    // bash for pipefail, so that a failed dump does not pass as a backup.
    const child = spawn("bash", ["-c", `set -o pipefail; ${script}`], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    child.stderr.on("data", (chunk) => (errors += chunk));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(errors.trim() || `exit ${code}`))));
  });
}

export interface BackupResult {
  files: { name: string; size: number }[];
  removed: number;
}

export async function runBackup(now = new Date()): Promise<BackupResult> {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  if (!passphrase) throw new Error("BACKUP_PASSPHRASE is not set");
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const stamp = `${now.toISOString().replace(/[:T]/g, "-").slice(0, 19)}-${randomBytes(6).toString("hex")}`;
  const database = join(dir, `db-${stamp}.dump.enc`);
  const archive = join(dir, `files-${stamp}.tar.gz.enc`);
  const encrypt = (target: string) => `openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out '${target}'`;
  const env = { BACKUP_PASSPHRASE: passphrase };
  // Write to a private temp file and move it into place only when complete,
  // so a failed run can never truncate or delete another run's backup.
  const save = async (command: (out: string) => string, target: string) => {
    const temp = `${target}.${randomBytes(4).toString("hex")}.tmp`;
    try {
      await run(command(temp), env);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  };

  await save((out) => `pg_dump --format=custom --no-owner "$DATABASE_URL" | ${encrypt(out)}`, database);
  const filesDir = process.env.FILES_DIR ?? "/data/files";
  // A new installation has no folder yet; an empty archive is a good backup, a failing nightly job is not.
  await mkdir(filesDir, { recursive: true });
  await save((out) => `tar czf - --exclude=.tmp -C '${filesDir}' . | ${encrypt(out)}`, archive);

  let removed = 0;
  const limit = now.getTime() - KEEP_DAYS * 86_400_000;
  for (const name of await readdir(dir)) {
    const info = await stat(join(dir, name));
    if (info.mtimeMs < limit && /\.enc$/.test(name)) {
      await rm(join(dir, name));
      removed++;
    }
  }
  const files = await Promise.all(
    [database, archive].map(async (path) => ({ name: path.split("/").pop()!, size: (await stat(path)).size })),
  );
  return { files, removed };
}

export async function listBackups() {
  const dir = backupDir();
  const names = await readdir(dir).catch(() => [] as string[]);
  const entries = await Promise.all(
    names
      .filter((n) => n.endsWith(".enc"))
      .map(async (name) => {
        const info = await stat(join(dir, name));
        return { name, size: info.size, createdAt: info.mtime.toISOString() };
      }),
  );
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
