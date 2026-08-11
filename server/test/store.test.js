import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { Store } from "../src/store.js";

const files = [];
afterEach(async () => {
  await Promise.all(
    files.splice(0).map((file) => fs.rm(file, { force: true })),
  );
});

describe("Store bootstrap administrator", () => {
  it("reconciles a rotated environment password on restart", async () => {
    const file = path.join(
      os.tmpdir(),
      `worldgpz-store-${process.pid}-${Date.now()}.json`,
    );
    files.push(file);
    const base = {
      databaseUrl: "",
      databaseSsl: false,
      localDataFile: file,
    };
    const first = await new Store({
      ...base,
      admin: {
        email: "admin@example.test",
        name: "Original Admin",
        password: "Original!Password#2026",
      },
    }).init();
    await first.close();

    const second = await new Store({
      ...base,
      admin: {
        email: "admin@example.test",
        name: "Rotated Admin",
        password: "Rotated!Password#2026",
      },
    }).init();
    const user = await second.getUserByEmail("admin@example.test");
    expect(user.name).toBe("Rotated Admin");
    expect(
      await bcrypt.compare("Rotated!Password#2026", user.password_hash),
    ).toBe(true);
    expect(
      await bcrypt.compare("Original!Password#2026", user.password_hash),
    ).toBe(false);
    await second.close();
  });
});
