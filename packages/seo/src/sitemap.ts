import type {SeoEntity} from "./types";

export interface SitemapEntry{url:string;lastmod?:string}

export interface RobotsAiPolicy {
  readonly oaiSearchBot?: boolean;
  readonly gptBot?: boolean;
  readonly googleExtended?: boolean;
  readonly claudeBot?: boolean;
  readonly perplexityBot?: boolean;
  readonly crawlDelaySeconds?: number;
}
function escapeXml(v:string):string{return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function normalizeEntries(entries:readonly(string|SitemapEntry)[]):SitemapEntry[]{
 const seen=new Set<string>();const result:SitemapEntry[]=[];
 for(const entry of entries){const item=typeof entry==="string"?{url:entry}:{url:entry.url,lastmod:entry.lastmod};const url=item.url.trim();if(!url||seen.has(url))continue;try{const parsed=new URL(url);if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")continue;}catch{continue;}seen.add(url);result.push(item.lastmod ? {url,lastmod:item.lastmod} : {url});}
 return result.sort((a,b)=>a.url.localeCompare(b.url));
}
export const SITEMAP_URL_LIMIT = 50000;
export function buildSitemapXml(entries:readonly(string|SitemapEntry)[]):string{
 const body=normalizeEntries(entries).map(entry=>"<url><loc>"+escapeXml(entry.url)+"</loc>"+(entry.lastmod?"<lastmod>"+escapeXml(entry.lastmod)+"</lastmod>":"")+"</url>").join("");
 return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"+body+"</urlset>";
}
export function buildRobotsTxt(
  sitemapUrl:string,
  disallowedPaths:readonly string[]=["/api/","/account","/billing","/customer","/communication","/operations","/trust","/checkout"],
  aiPolicy: RobotsAiPolicy = {},
):string{
 const lines=["User-agent: *","Allow: /",...disallowedPaths.filter(Boolean).map(path=>"Disallow: "+path)];
 const bots: readonly [string, boolean | undefined][] = [
   ["OAI-SearchBot", aiPolicy.oaiSearchBot],
   ["GPTBot", aiPolicy.gptBot],
   ["Google-Extended", aiPolicy.googleExtended],
   ["ClaudeBot", aiPolicy.claudeBot],
   ["PerplexityBot", aiPolicy.perplexityBot],
 ];
 for (const [userAgent, allowed] of bots) {
   if (allowed === undefined) continue;
   lines.push("User-agent: "+userAgent, allowed ? "Allow: /" : "Disallow: /");
 }
 if (aiPolicy.crawlDelaySeconds !== undefined && Number.isFinite(aiPolicy.crawlDelaySeconds) && aiPolicy.crawlDelaySeconds >= 0) {
   lines.push("User-agent: *", "Crawl-delay: "+String(aiPolicy.crawlDelaySeconds));
 }
 if(sitemapUrl.trim())lines.push("Sitemap: "+sitemapUrl.trim());return lines.join("\n")+"\n";
}
export function indexableEntities(e:readonly SeoEntity[],p:(x:SeoEntity)=>boolean):readonly SeoEntity[]{return e.filter(p)}
export function buildSitemapIndexXml(sitemapUrls: readonly string[]): string {
 const urls=Array.from(new Set(sitemapUrls.map((value)=>value.trim()).filter(Boolean))).filter((value)=>{try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}}).sort();
 const body=urls.map((url)=>"<sitemap><loc>"+escapeXml(url)+"</loc></sitemap>").join("");
 return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"+body+"</sitemapindex>";
}

export interface ImageSitemapEntry { readonly url: string; readonly images: readonly string[]; readonly lastmod?: string; }

export function buildImageSitemapXml(entries: readonly ImageSitemapEntry[]): string {
  const normalized = entries.map((entry) => ({
    ...entry,
    url: entry.url.trim(),
    images: Array.from(new Set(entry.images.map((image) => image.trim()).filter(Boolean))),
  })).filter((entry) => {
    if (!entry.url || entry.images.length === 0) return false;
    try { const u = new URL(entry.url); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
  }).sort((a, b) => a.url.localeCompare(b.url));
  const body = normalized.map((entry) =>
    "<url><loc>" + escapeXml(entry.url) + "</loc>" +
    entry.images.map((image) => "<image:image><image:loc>" + escapeXml(image) + "</image:loc></image:image>").join("") +
    (entry.lastmod ? "<lastmod>" + escapeXml(entry.lastmod) + "</lastmod>" : "") +
    "</url>",
  ).join("");
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\">" + body + "</urlset>";
}
