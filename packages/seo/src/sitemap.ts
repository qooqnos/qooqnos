import type {SeoEntity} from "./types";

export interface SitemapEntry{url:string;lastmod?:string}
function escapeXml(v:string):string{return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function normalizeEntries(entries:readonly(string|SitemapEntry)[]):SitemapEntry[]{
 const seen=new Set<string>();const result:SitemapEntry[]=[];
 for(const entry of entries){const item=typeof entry==="string"?{url:entry}:{url:entry.url,lastmod:entry.lastmod};const url=item.url.trim();if(!url||seen.has(url))continue;try{const parsed=new URL(url);if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")continue;}catch{continue;}seen.add(url);result.push({url,lastmod:item.lastmod});}
 return result.sort((a,b)=>a.url.localeCompare(b.url));
}
export const SITEMAP_URL_LIMIT = 50000;
export function buildSitemapXml(entries:readonly(string|SitemapEntry)[]):string{
 const body=normalizeEntries(entries).map(entry=>"<url><loc>"+escapeXml(entry.url)+"</loc>"+(entry.lastmod?"<lastmod>"+escapeXml(entry.lastmod)+"</lastmod>":"")+"</url>").join("");
 return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"+body+"</urlset>";
}
export function buildRobotsTxt(sitemapUrl:string,disallowedPaths:readonly string[]=["/api/","/account","/billing","/customer","/communication","/operations","/trust","/checkout"]):string{
 const lines=["User-agent: *","Allow: /",...disallowedPaths.filter(Boolean).map(path=>"Disallow: "+path)];if(sitemapUrl.trim())lines.push("Sitemap: "+sitemapUrl.trim());return lines.join("\n")+"\n";
}
export function indexableEntities(e:readonly SeoEntity[],p:(x:SeoEntity)=>boolean):readonly SeoEntity[]{return e.filter(p)}
export function buildSitemapIndexXml(sitemapUrls: readonly string[]): string {
 const urls=Array.from(new Set(sitemapUrls.map((value)=>value.trim()).filter(Boolean))).filter((value)=>{try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}}).sort();
 const body=urls.map((url)=>"<sitemap><loc>"+escapeXml(url)+"</loc></sitemap>").join("");
 return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"+body+"</sitemapindex>";
}
