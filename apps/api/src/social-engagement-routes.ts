import { brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import { SocialEngagementRepository } from "@qooqnos/social-engagement";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerSocialEngagementRoutes(router: ApiRouter, database: D1Database | undefined): void {
  const repo = () => { if (!database) throw new Error("Database is not configured"); return new SocialEngagementRepository(database); };

  router.register({ method:"GET", path:"/api/v1/social/activity", module:"social-engagement", operation:"social.activity.list", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,request})=>{const limit=Number(new URL(request.url).searchParams.get("limit") ?? "20");return json({data:await repo().activity(context,Number.isFinite(limit)?limit:20)},200,context.requestId)}
  });
  router.register({ method:"POST", path:"/api/v1/social/follows", module:"social-engagement", operation:"social.follow.create", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,request})=>{const b=await object(request);const r=await repo().follow(context,{id:brandId<EntityId>(crypto.randomUUID()),targetType:followTarget(b.targetType),targetId:brandId<EntityId>(stringValue(b.targetId)),now:new Date().toISOString()});return json({data:r},201,context.requestId);}
  });
  router.register({ method:"DELETE", path:"/api/v1/social/follows/:id", module:"social-engagement", operation:"social.follow.remove", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,params})=>json({data:await repo().removeFollow(context,brandId<EntityId>(requiredParam(params.id)),new Date().toISOString())},200,context.requestId)
  });
  router.register({ method:"POST", path:"/api/v1/social/likes", module:"social-engagement", operation:"social.like.create", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,request})=>{const b=await object(request);const r=await repo().engage(context,{id:brandId<EntityId>(crypto.randomUUID()),targetType:engagementTarget(b.targetType),targetId:brandId<EntityId>(stringValue(b.targetId)),engagementType:"like",now:new Date().toISOString()});return json({data:r},201,context.requestId);}
  });
  router.register({ method:"DELETE", path:"/api/v1/social/likes/:id", module:"social-engagement", operation:"social.like.remove", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,params})=>json({data:await repo().removeEngagement(context,brandId<EntityId>(requiredParam(params.id)),new Date().toISOString())},200,context.requestId)
  });
  router.register({ method:"POST", path:"/api/v1/social/saves", module:"social-engagement", operation:"social.save.create", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,request})=>{const b=await object(request);const r=await repo().engage(context,{id:brandId<EntityId>(crypto.randomUUID()),targetType:engagementTarget(b.targetType),targetId:brandId<EntityId>(stringValue(b.targetId)),engagementType:"save",now:new Date().toISOString()});return json({data:r},201,context.requestId);}
  });
  router.register({ method:"DELETE", path:"/api/v1/social/saves/:id", module:"social-engagement", operation:"social.save.remove", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,params})=>json({data:await repo().removeEngagement(context,brandId<EntityId>(requiredParam(params.id)),new Date().toISOString())},200,context.requestId)
  });
  router.register({ method:"POST", path:"/api/v1/social/comments", module:"social-engagement", operation:"social.comment.create", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,request})=>{const b=await object(request);const r=await repo().comment(context,{id:brandId<EntityId>(crypto.randomUUID()),targetType:engagementTarget(b.targetType),targetId:brandId<EntityId>(stringValue(b.targetId)),body:stringValue(b.body),idempotencyKey:stringValue(b.idempotencyKey),now:new Date().toISOString()});return json({data:r},201,context.requestId);}
  });
  router.register({ method:"DELETE", path:"/api/v1/social/comments/:id", module:"social-engagement", operation:"social.comment.remove", requireAuthentication:true, requireWorkspace:false,
    handler:async ({context,params})=>json({data:await repo().removeComment(context,brandId<EntityId>(requiredParam(params.id)),new Date().toISOString())},200,context.requestId)
  });
}
async function object(request:Request):Promise<Record<string,unknown>>{const value:unknown=await request.json();if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Request body must be an object");return value as Record<string,unknown>;}
function stringValue(v:unknown):string{if(typeof v!=="string"||!v.trim())throw new Error("Required string is missing");return v.trim();}
function requiredParam(v:string|undefined):string{if(!v?.trim())throw new Error("Route parameter is required");return v;}
function followTarget(v:unknown):"user"|"business"{const s=stringValue(v);if(s!=="user"&&s!=="business")throw new Error("Invalid follow target type");return s;}
function engagementTarget(v:unknown):"product"|"service"|"post"|"business"{const s=stringValue(v);if(s!=="product"&&s!=="service"&&s!=="post"&&s!=="business")throw new Error("Invalid social target type");return s;}
