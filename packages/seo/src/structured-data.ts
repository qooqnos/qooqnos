import type {SeoEntity,StructuredData} from "./types";

const TYPE_MAP:Readonly<Record<SeoEntity["type"],string>>={
  Organization:"Organization",Business:"LocalBusiness",Person:"Person",Service:"Service",
  Product:"Product",Offer:"Offer",Location:"Place",Branch:"LocalBusiness",Category:"Thing",
  Collection:"CollectionPage",Review:"Review",FAQ:"FAQPage",Article:"Article",Event:"Event",
  Brand:"Brand",Credential:"EducationalOccupationalCredential",
};

function clean(value:string|undefined):string{return(value??"").replace(/\\s+/g," ").trim();}
function validHttpUrl(value:string):boolean{try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}}
function unique(values:readonly string[]):string[]{return [...new Set(values.map(clean).filter(Boolean))];}

export function generateStructuredData(e:SeoEntity):StructuredData{
  const type=TYPE_MAP[e.type];
  const name=clean(e.preferredName);
  const description=clean(e.description)||clean(e.summary);
  const alternateNames=unique(e.alternateNames??[]);
  const sameAs=unique(e.sameAs??[]).filter(validHttpUrl);
  const x:StructuredData={"@context":"https://schema.org","@type":type,name,inLanguage:clean(e.locale)||"en"};
  if(description)x.description=description;
  if(alternateNames.length)x.alternateName=alternateNames;
  if(sameAs.length)x.sameAs=sameAs;
  if(e.canonicalId){
    if(validHttpUrl(e.canonicalId))x["@id"]=e.canonicalId;
    else x.identifier=e.canonicalId;
  }
  if(e.country)x.areaServed={"@type":"Country",name:clean(e.country)};
  const areas=unique(e.serviceArea??[]);
  if(areas.length)x.areaServed=areas.map(area=>({"@type":"Place",name:area}));
  if(e.geoScope)x.additionalType="https://schema.org/"+(e.geoScope==="exact"?"Place":e.geoScope==="city"?"City":e.geoScope==="region"?"AdministrativeArea":e.geoScope==="country"?"Country":"Place");
  if(e.type==="Article"){
    x.dateModified=e.updatedAt;
    x.headline=name;
  }
  if(e.type==="Event")x.eventStatus="https://schema.org/EventScheduled";
  return x;
}
