import type {SeoContext,SeoMetadata,SeoPolicy} from "./types";

const TITLE_LIMIT=60;
const DESCRIPTION_LIMIT=160;
const DEFAULT_SITE_NAME="Phoenix";
const DEFAULT_IMAGE="/og/default.png";
const DESCRIPTION_FALLBACK="Discover verified information about this Phoenix entity.";

function clean(value:string|undefined):string{return(value??"").replace(/\s+/g," ").trim();}
function limit(value:string,max:number):string{return value.length>max?value.slice(0,max-1).trimEnd()+"…":value;}
function languageOf(locale:string):string{return clean(locale).replace(/_/g,"-").split("-")[0].toLowerCase()||"en";}
function normalizeLocale(locale:string):string{const parts=clean(locale).replace(/_/g,"-").split("-").filter(Boolean);if(!parts.length)return"en";return parts[0].toLowerCase()+(parts[1]?"-"+parts[1].toUpperCase():"");}
function safeUrl(value:string):string{const raw=clean(value);if(!raw)return"";try{const parsed=new URL(raw);if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")return"";return parsed.toString();}catch{return"";}}
function resolveUrl(base:string,value:string|undefined):string{const v=clean(value);if(!v)return"";try{return new URL(v,safeUrl(base)+"/").toString();}catch{return"";}}
function inferTitle(name:string,site:string):string{const n=clean(name)||site;if(!n)return site;if(n.toLowerCase()===site.toLowerCase())return n;return limit(n+" | "+site,TITLE_LIMIT);}
function buildAlternates(c:SeoContext,canonical:string,locale:string):SeoMetadata["alternates"]{if(!canonical)return[];const configured=(c as SeoContext & {alternates?:readonly {locale:string;url:string}[]}).alternates??[];const items=[{rel:"alternate" as const,hreflang:locale,href:canonical},...configured.map(x=>({rel:"alternate" as const,hreflang:normalizeLocale(x.locale),href:safeUrl(x.url)})).filter(x=>x.href)];const seen=new Set<string>();const out:SeoMetadata["alternates"]=[];for(const item of items){const key=item.hreflang+"|"+item.href;if(seen.has(key))continue;seen.add(key);out.push(item);}if(!out.some(x=>x.hreflang==="x-default"))out.push({rel:"alternate",hreflang:"x-default",href:canonical});return out;}

export function generateMetadata(c:SeoContext,url:string,policy?:SeoPolicy):SeoMetadata{
 const entity=c.entity;
 const canonicalUrl=safeUrl(policy?.canonicalUrl||url);
 const language=languageOf(entity.locale);
 const locale=normalizeLocale(entity.locale);
 const siteName=DEFAULT_SITE_NAME;
 const title=inferTitle(entity.preferredName,siteName);
 const description=limit(clean(entity.summary)||clean(entity.description)||clean(entity.preferredName)||DESCRIPTION_FALLBACK,DESCRIPTION_LIMIT);
 const indexability=policy?.indexability??(entity.visibility==="public"&&entity.publicationState==="published"?"index":"noindex");
 const robots=indexability==="index"?"index,follow":"noindex,nofollow";
 const image=resolveUrl(c.canonicalBaseUrl,(entity as SeoContext["entity"] & {imageUrl?:string}).imageUrl)||resolveUrl(c.canonicalBaseUrl,DEFAULT_IMAGE);
 const openGraph={title,description,url:canonicalUrl,type:entity.type==="Article"?"article":"website",locale,siteName,image:image||undefined};
 const twitter={card:image?"summary_large_image":"summary" as const,title,description,image:image||undefined};
 return{title,description,canonicalUrl,robots,headings:[title],altTexts:[],openGraph,twitter,alternates:buildAlternates(c,canonicalUrl,locale),language,locale};
}