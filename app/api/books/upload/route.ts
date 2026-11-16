import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { blobToken } from "@/lib/server/storage";

/** Issues client-upload tokens so large PDFs go straight from the browser to Vercel Blob. */
export async function POST(request: Request) {
  const token = blobToken();
  if (!token) {
    return Response.json({ error: "blob_not_configured" }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      token,
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: 300 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // The browser saves the URL on the book itself (PATCH /api/books/[id]).
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
