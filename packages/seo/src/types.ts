export type SeoEntityType="Organization"|"Business"|"Person"|"Service"|"Product"|"Offer"|"Location"|"Branch"|"Category"|"Collection"|"Review"|"FAQ"|"Article"|"Event"|"Brand"|"Credential";
export type PublicationState="draft"|"review"|"published"|"unpublished"|"deleted";
export type Visibility="public"|"restricted"|"private";
export type Indexability="index"|"noindex"|"restricted"|"excluded";
export type GeoScope="exact"|"branch"|"city"|"region"|"country"|"service-area";
export interface SeoProductVariantSeo { readonly id: string; readonly sku?: string; readonly name?: string; readonly description?: string; readonly url?: string; readonly imageUrl?: string; readonly price?: number; readonly currency?: string; readonly availability?: string; readonly attributes?: Readonly<Record<string, string>>; }
export interface SeoShippingDetails { readonly country?: string; readonly postalCode?: string; readonly region?: string; readonly shippingRate?: number; readonly currency?: string; readonly handlingTimeMinDays?: number; readonly handlingTimeMaxDays?: number; }
export interface SeoGeoPoint { readonly latitude: number; readonly longitude: number; }
export interface SeoOpeningHours { readonly dayOfWeek: readonly string[]; readonly opens: string; readonly closes: string; }
export interface SeoReturnPolicy { readonly applicableCountry?: string; readonly returnWindowDays?: number; readonly returnFees?: "FreeReturn"|"ReturnFeesCustomerResponsibility"|"ReturnShippingFees"; readonly returnMethod?: "ReturnByMail"|"ReturnInStore"|"ReturnAtKiosk"; }
export interface SeoEntityRelationship { readonly entityId: string; readonly relation: string; }
export interface SeoEntity{ id:string; type:SeoEntityType; sourceModule:string; sourceVersion:string; publicationState:PublicationState; visibility:Visibility; preferredName:string; alternateNames?:readonly string[]; summary?:string; description?:string; locale:string; country?:string; geoScope?:GeoScope; locationId?:string; serviceArea?:readonly string[]; canonicalId?:string; relatedEntityIds?:readonly string[]; relatedEntities?:readonly SeoEntityRelationship[]; sameAs?:readonly string[]; imageUrl?:string; telephone?:string; email?:string; priceRange?:string; price?:number; currency?:string; availability?:string; brandName?:string; categoryName?:string; productGroupId?:string; variantDimensions?:readonly string[]; productVariants?:readonly SeoProductVariantSeo[]; geoPoint?:SeoGeoPoint; openingHours?:readonly SeoOpeningHours[]; shippingDetails?:SeoShippingDetails; returnPolicy?:SeoReturnPolicy; aggregateRating?:SeoAggregateRating; startDate?:string; endDate?:string; address?:{streetAddress?:string;addressLocality?:string;addressRegion?:string;postalCode?:string;addressCountry?:string}; updatedAt:string}
export interface SeoAggregateRating {
  readonly ratingValue: number;
  readonly reviewCount: number;
  readonly bestRating: number;
  readonly worstRating: number;
}

export interface SeoContext{entity:SeoEntity;canonicalBaseUrl:string;alternates?:readonly {locale:string;url:string}[]}
export interface SeoPolicy{indexability:Indexability;reason:string;canonicalUrl?:string;includeInSitemap:boolean}
export interface SeoMetadata{title:string;description:string;canonicalUrl:string;robots:string;headings:string[];altTexts:string[];openGraph:{title:string;description:string;url:string;type:string;locale:string;siteName?:string;image?:string};twitter:{card:"summary"|"summary_large_image";title:string;description:string;image?:string};alternates:readonly {rel:"alternate";hreflang:string;href:string}[];language:string;locale:string}
export interface BreadcrumbItem{name:string;url:string}
export interface AnswerFact{fact:string;sourceEntityId:string;verifiedAt?:string|undefined;provenanceUrl?:string|undefined;sourceType?:string|undefined;validUntil?:string|undefined}
export interface AnswerGeography{scope:GeoScope;country?:string;locationId?:string;serviceAreaIds:readonly string[];remoteAvailable:boolean}
export interface AnswerRepresentation{id:string;entityId:string;locale:string;question:string;answer:string;canonicalUrl?:string|undefined;facts:readonly AnswerFact[];freshnessAt:string;sourceUpdatedAt:string;confidence:"verified"|"sourced"|"pending-review"|"restricted";citationReady:boolean;geography?:AnswerGeography;limitations:readonly string[]}
export interface StructuredData{"@context":"https://schema.org";"@type":string;[key:string]:unknown}
export interface SeoAuditIssue{code:string;severity:"info"|"warning"|"error";evidence:string;owner:string;recommendation:string}
export interface SeoAudit{entityId:string;scores:Record<string,number>;overallScore:number;status:"pass"|"warning"|"blocked";blockingIssueCodes:readonly string[];issues:readonly SeoAuditIssue[];generatedAt:string}