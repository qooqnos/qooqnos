import type {SeoContext,SeoMetadata,SeoPolicy} from "./types";

const DESCRIPTION_LIMIT=160;
function clean(value:string|undefined):string{return(value??"").replace(/\s+/g," ").trim();}
function localeToHreflang(locale:string):string{return clean(locale).replace(/_/g,"-")||"x-default";}

export function generateMetadata(c:SeoContext,url:string,policy?:SeoPolicy):SeoMetadata{
  const entity=c.entity;
  const title=clean(entity.preferredName)||"Phoenix";
  const description=(clean(entity.summary)||clean(entity.description)||title).slice(0,DESCRIPTION_LIMIT);
  const canonicalUrl=url.trim();
  const indexable=policy?.indexability==="index"||(!policy&&entity.visibility==="public"&&entity.publicationState==="published");
  const robots=indexable?"index,follow":"noindex,nofollow";
  const locale=localeToHreflang(entity.locale);
  const alternates=canonicalUrl?[{rel:"alternate" as const,hreflang:locale,href:canonicalUrl},{rel:"alternate" as const,hreflang:"x-default",href:canonicalUrl}]:[];
  return{title,description,canonicalUrl,robots,headings:[title],altTexts:[],openGraph:{title,description,url:canonicalUrl,type:"website",locale,siteName:"Phoenix"},twitter:{card:"summary_large_image",title,description},alternates};
}