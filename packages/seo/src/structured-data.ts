import type {SeoEntity,StructuredData} from "./types";

const TYPE_MAP:Readonly<Record<SeoEntity["type"],string>>={Organization:"Organization",Business:"LocalBusiness",Person:"Person",Service:"Service",Product:"Product",Offer:"Offer",Location:"Place",Branch:"LocalBusiness",Category:"Thing",Collection:"CollectionPage",Review:"Review",FAQ:"FAQPage",Article:"Article",Event:"Event",Brand:"Brand",Credential:"EducationalOccupationalCredential"};

export function generateStructuredData(e:SeoEntity):StructuredData{
  const x:StructuredData={"@context":"https://schema.org","@type":TYPE_MAP[e.type],name:e.preferredName,inLanguage:e.locale};
  if(e.description)x.description=e.description;
  if(e.alternateNames?.length)x.alternateName=[...e.alternateNames];
  if(e.sameAs?.length)x.sameAs=[...e.sameAs];
  if(e.canonicalId)x.identifier=e.canonicalId;
  if(e.country)x.areaServed={"@type":"Country",name:e.country};
  if(e.serviceArea?.length)x.areaServed=e.serviceArea.map(name=>({"@type":"Place",name}));
  return x;
}