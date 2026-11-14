// Copies the pdf.js worker into /public so the browser can load it
// without bundler-specific worker handling. Runs on postinstall.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const src = path.join(pkgDir, "build", "pdf.worker.min.mjs");
const destDir = path.join(process.cwd(), "public");
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, path.join(destDir, "pdf.worker.min.mjs"));
console.log("pdf.js worker copied to public/pdf.worker.min.mjs");
