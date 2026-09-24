export type SeoEntityType="Organization"|"Business"|"Person"|"Service"|"Product"|"Offer"|"Location"|"Branch"|"Category"|"Collection"|"Review"|"FAQ"|"Article"|"Event"|"Brand"|"Credential";
export type PublicationState="draft"|"review"|"published"|"unpublished"|"deleted";
export type Visibility="public"|"restricted"|"private";
export type Indexability="index"|"noindex"|"restricted"|"excluded";
export type GeoScope="exact"|"branch"|"city"|"region"|"country"|"service-area";
export interface SeoEntity{id:string;type:SeoEntityType;sourceModule:string;sourceVersion:string;publicationState:PublicationState;visibility:Visibility;preferredName:string;alternateNames?:readonly string[];summary?:string;description?:string;locale:string;country?:string;geoScope?:GeoScope;locationId?:string;serviceArea?:readonly string[];canonicalId?:string;relatedEntityIds?:readonly string[];sameAs?:readonly string[];updatedAt:string}
export interface SeoContext{entity:SeoEntity;canonicalBaseUrl:string}
export interface SeoPolicy{indexability:Indexability;reason:string;canonicalUrl?:string;includeInSitemap:boolean}
export interface SeoMetadata{title:string;description:string;canonicalUrl:string;robots:string;headings:string[];altTexts:string[];openGraph:{title:string;description:string;url:string;type:string;locale:string;siteName?:string};twitter:{card:"summary"|"summary_large_image";title:string;description:string};alternates:readonly {rel:"alternate";hreflang:string;href:string}[]}
export interface AnswerFact{fact:string;sourceEntityId:string;verifiedAt?:string}
export interface AnswerRepresentation{id:string;question:string;answer:string;facts:readonly AnswerFact[];freshnessAt:string;confidence:"verified"|"sourced"|"pending-review"|"restricted"}
export interface StructuredData{"@context":"https://schema.org";"@type":string;[key:string]:unknown}
export interface SeoAuditIssue{code:string;severity:"info"|"warning"|"error";evidence:string;owner:string;recommendation:string}
export interface SeoAudit{entityId:string;scores:Record<string,number>;issues:readonly SeoAuditIssue[];generatedAt:string}