export const REPOSITORY = "hulingjun/hulingjun.github.io";
export const OWNER_ID = 166984918;
export const CONSENT = "我确认只上传可公开展示的画作，不含孩子的姓名、学校、住址等隐私。";
export const MAX_BYTES = 10 * 1024 * 1024;

export function section(body, name) {
  const sections = String(body ?? "").replace(/\r\n/g, "\n").split(/^### /m).slice(1);
  const found = sections.find(s => s.split("\n")[0].trim() === name);
  return found ? found.slice(found.indexOf("\n") + 1).trim().replace(/^_No response_$/, "") : "";
}

export function safeAssetUrl(value, redirect = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error("图片链接格式不正确"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("只接受 GitHub 图片附件");
  const modern = url.hostname === "github.com" && /^\/user-attachments\/assets\/[a-f\d-]{36}$/i.test(url.pathname);
  const legacy = url.hostname === "user-images.githubusercontent.com" && /^\/\d+\//.test(url.pathname);
  const redirected = redirect && ["private-user-images.githubusercontent.com", "objects.githubusercontent.com"].includes(url.hostname);
  if (!(modern || legacy || redirected)) throw new Error("请使用 GitHub 上传的图片附件，不要粘贴外部图片网址");
  return url.href;
}

export function parseArtwork(issue) {
  if (issue.pull_request || issue.state !== "open" || issue.user?.id !== OWNER_ID || !issue.title?.startsWith("[画作]")) return null;
  if (!Number.isSafeInteger(issue.number) || issue.number < 1) throw new Error("作品编号无效");
  const title = section(issue.body, "作品名称");
  const date = section(issue.body, "创作日期");
  const story = section(issue.body, "作品故事");
  const confirmation = section(issue.body, "公开确认");
  if (!title || title.length > 80 || title.includes("\n")) throw new Error("作品名称需为 1–80 个字的一行文字");
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) throw new Error("创作日期请填写有效的 YYYY-MM-DD；不记得可以留空");
  if (/贝贝|王洁|营养师|瑜伽|普拉提/.test(title+"\n"+story)) throw new Error("这份内容属于已屏蔽的项目或主题，不会公开收录");
  if (story.length > 1200) throw new Error("作品故事请保持在 1200 字以内");
  if (!confirmation.includes("- [x] " + CONSENT) && !confirmation.includes("- [X] " + CONSENT)) throw new Error("请勾选公开展示确认");
  const images = section(issue.body, "作品图片");
  const urls = [...images.matchAll(/https:\/\/(?:github\.com\/user-attachments\/assets\/[a-f\d-]+|user-images\.githubusercontent\.com\/[^\s<>"')]+)/gi)].map(m => safeAssetUrl(m[0]));
  const unique = [...new Set(urls)];
  if (unique.length !== 1) throw new Error("每条记录请上传一张 JPG、PNG、WebP 或 GIF 图片");
  return { id: issue.number, title, date: date || null, story, assetUrl: unique[0],
    sourceUrl: "https://github.com/" + REPOSITORY + "/issues/" + issue.number };
}

export async function downloadImage(url, fetcher = fetch) {
  let current = safeAssetUrl(url);
  for (let i = 0; i < 6; i++) {
    const response = await fetcher(current, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("图片下载跳转失败");
      current = safeAssetUrl(new URL(location, current).href, true);
      continue;
    }
    if (!response.ok) throw new Error("图片下载失败（HTTP " + response.status + "），请重新上传图片后编辑记录");
    if (!/^image\/(?:jpeg|png|webp|gif)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error("图片格式不支持，请转为 JPG 或 PNG");
    if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("图片不能超过 10 MB");
    if (!response.body) throw new Error("图片内容为空");
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("图片不能超过 10 MB"); }
      chunks.push(value);
    }
    if (!size) throw new Error("图片内容为空");
    return Buffer.concat(chunks);
  }
  throw new Error("图片跳转次数过多");
}
