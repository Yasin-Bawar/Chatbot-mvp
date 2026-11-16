import { afterEach, describe, expect, it } from "vitest";
import { blobMode, blobSetupProblem, blobStoreId, blobToken, blobWebhookPublicKey, storageKind } from "@/lib/server/storage";

const saved = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});

function clearBlob() {
  for (const key of Object.keys(process.env)) if (key.includes("BLOB")) delete process.env[key];
}

describe("Vercel Blob detection", () => {
  it("uses a read-write token", () => {
    clearBlob();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_abc_123";
    expect(blobToken()).toBe("vercel_blob_rw_abc_123");
    expect(blobMode()).toBe("token");
    expect(storageKind()).toBe("blob");
  });

  it("finds a token under a custom prefix", () => {
    clearBlob();
    process.env.CHATBOTMVP_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_xyz_789";
    expect(blobToken()).toBe("vercel_blob_rw_xyz_789");
  });

  it("supports keyless stores (store id + webhook key), also with a custom prefix", () => {
    clearBlob();
    process.env.BLOB_READ_WRITE_TOKEN_STORE_ID = "store_abc";
    process.env.BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY = "public-key";
    expect(blobToken()).toBeUndefined();
    expect(blobStoreId()).toBe("store_abc");
    expect(blobWebhookPublicKey()).toBe("public-key");
    expect(blobMode()).toBe("keyless");
    expect(blobSetupProblem()).toBeNull();
  });

  it("explains when nothing is set on Vercel", () => {
    clearBlob();
    process.env.VERCEL = "1";
    expect(storageKind()).toBe("none");
    expect(blobSetupProblem()).toBe("missing");
  });

  it("ignores unrelated *_READ_WRITE_TOKEN variables", () => {
    clearBlob();
    process.env.OTHER_READ_WRITE_TOKEN = "not-a-blob-token";
    expect(blobToken()).toBeUndefined();
  });
});
