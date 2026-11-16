import { afterEach, describe, expect, it } from "vitest";
import { blobSetupProblem, blobToken, storageKind } from "@/lib/server/storage";

const saved = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});

describe("Vercel Blob detection", () => {
  it("uses BLOB_READ_WRITE_TOKEN", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_abc_123";
    expect(blobToken()).toBe("vercel_blob_rw_abc_123");
    expect(storageKind()).toBe("blob");
  });

  it("finds the token under a custom prefix", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.CHATBOTMVP_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_xyz_789";
    expect(blobToken()).toBe("vercel_blob_rw_xyz_789");
    expect(blobSetupProblem()).toBeNull();
  });

  it("explains what is missing on Vercel", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL = "1";
    expect(storageKind()).toBe("none");
    expect(blobSetupProblem()).toBe("missing");
    process.env.BLOB_STORE_ID = "store_abc";
    expect(blobSetupProblem()).toBe("store_id_only");
  });

  it("ignores unrelated *_READ_WRITE_TOKEN variables", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.OTHER_READ_WRITE_TOKEN = "not-a-blob-token";
    expect(blobToken()).toBeUndefined();
  });
});
