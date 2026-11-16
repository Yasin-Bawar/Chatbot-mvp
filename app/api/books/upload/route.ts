import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { blobMode, blobStoreId, blobToken, blobWebhookPublicKey } from "@/lib/server/storage";

const MAX_BYTES = 300 * 1024 * 1024;
const PDF = ["application/pdf"];

/** Only book files may be uploaded: books/<bookId>.pdf */
function checkPathname(pathname: string) {
  if (!/^books\/[\w-]+\.pdf$/.test(pathname)) throw new Error("invalid pathname");
}

/**
 * Lets the browser upload a large PDF straight to Vercel Blob (Vercel functions
 * accept at most 4.5 MB). Works with both kinds of Blob connection:
 * a read-write token (client tokens) or a keyless store (presigned URLs).
 */
export async function POST(request: Request) {
  const mode = blobMode();
  if (!mode) return Response.json({ error: "blob_not_configured" }, { status: 503 });
  try {
    if (mode === "token") {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        token: blobToken(),
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          checkPathname(pathname);
          return { allowedContentTypes: PDF, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
        },
      });
      return Response.json(result);
    }

    const body = (await request.json()) as HandleUploadPresignedBody;
    const result = await handleUploadPresigned({
      body,
      request,
      webhookPublicKey: blobWebhookPublicKey(),
      getSignedToken: async (pathname) => {
        checkPathname(pathname);
        const token = await issueSignedToken({
          storeId: blobStoreId(),
          pathname,
          operations: ["put"],
          allowedContentTypes: PDF,
          maximumSizeInBytes: MAX_BYTES,
        });
        return { token, urlOptions: { allowedContentTypes: PDF, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true } };
      },
    });
    return Response.json(result);
  } catch (err) {
    console.error("blob upload route failed", err);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
