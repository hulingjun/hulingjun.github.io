import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { REPOSITORY, parseArtwork, downloadImage } from "./gallery-model.mjs";

export async function transformImage(bytes, sharp) {
  const metadata = await sharp(bytes, { limitInputPixels: 80000000 }).metadata();
  if (!["jpeg","png","webp","gif"].includes(metadata.format)) throw new Error("请上传 JPG、PNG、WebP 或 GIF，不支持 SVG 或 HEIC");
  const make = width => sharp(bytes, { limitInputPixels: 80000000 }).rotate()
    .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  const full = await make(2400);
  const thumb = await make(720);
  return { full, thumb };
}

export async function listIssues(fetcher = fetch, token = process.env.GITHUB_TOKEN) {
  const issues = [];
  for (let page=1; page<=100; page++) {
    const response = await fetcher("https://api.github.com/repos/" + REPOSITORY + "/issues?state=open&per_page=100&page=" + page, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: "Bearer " + token } : {}) },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error("读取作品记录失败（HTTP " + response.status + "），保留上次线上版本");
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("作品记录返回格式异常");
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
  throw new Error("作品记录分页超出限制");
}

export async function buildGallery({ issues, output, sharp, fetcher = fetch }) {
  const art = []; const errors = [];
  await mkdir(path.join(output, "images"), { recursive: true });
  for (const issue of issues) {
    let record;
    try { record = parseArtwork(issue); } catch (error) {
      errors.push({ id: issue.number, message: error.message }); continue;
    }
    if (!record) continue;
    // A download failure must not silently remove a previously published work.
    const bytes = await downloadImage(record.assetUrl, fetcher);
    const { full, thumb } = await transformImage(bytes, sharp);
    const hash = createHash("sha256").update(full.data).digest("hex").slice(0,16);
    const stem = record.id + "-" + hash;
    await writeFile(path.join(output, "images", stem + ".webp"), full.data);
    await writeFile(path.join(output, "images", stem + "-small.webp"), thumb.data);
    const { assetUrl, ...publicRecord } = record;
    art.push({ ...publicRecord, image: "/art-data/images/" + stem + ".webp",
      thumbnail: "/art-data/images/" + stem + "-small.webp",
      width: full.info.width, height: full.info.height });
  }
  art.sort((a,b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id-a.id);
  const manifest = { version: 1, generatedAt: new Date().toISOString(), artworks: art };
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { count: art.length, publishedIds: art.map(a=>a.id), errors };
}

async function main() {
  const sharp = process.env.GALLERY_TOOLS_DIR
    ? createRequire(path.join(process.env.GALLERY_TOOLS_DIR, "package.json"))("sharp")
    : (await import("sharp")).default;
  const issues = process.env.GALLERY_FIXTURE ? JSON.parse(await readFile(process.env.GALLERY_FIXTURE,"utf8")) : await listIssues();
  const report = await buildGallery({ issues, output: "github-pages/public/art-data", sharp });
  await writeFile("gallery-report.json", JSON.stringify(report,null,2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = ["## 绘画作品", "已准备 " + report.count + " 幅作品。",
      ...report.errors.map(e => "- #" + e.id + "：" + e.message)];
    await writeFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", {flag:"a"});
  }
  console.log("Gallery prepared:", report.count, "works;", report.errors.length, "invalid submissions.");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(error => { console.error(error.message); process.exitCode=1; });
