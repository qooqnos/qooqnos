import { describe, expect, it } from "vitest";
import { createR2DocumentArtifactStore, type DocumentR2Bucket } from "./r2-artifact-store";

describe("R2 document artifact store",()=>{
  it("writes tenant-scoped idempotent keys and metadata",async()=>{
    const calls:Array<{key:string;value:unknown;options:unknown}>=[]; const bucket:DocumentR2Bucket={put:async(key,value,options)=>{calls.push({key,value,options});}};
    const store=createR2DocumentArtifactStore(bucket);
    const artifact={format:"pdf" as const,mediaType:"application/pdf",filename:"report.pdf",bytes:new Uint8Array([1,2,3]),sourceSnapshotHash:"a".repeat(64),rendererId:"phoenix.pdf",rendererVersion:1};
    const a=await store.put({organizationId:"org",workspaceId:"ws",actorId:"actor",artifact,idempotencyKey:"same"});
    const b=await store.put({organizationId:"org",workspaceId:"ws",actorId:"actor",artifact,idempotencyKey:"same"});
    expect(a.artifactReference).toBe(b.artifactReference);
    expect(calls).toHaveLength(2);
    expect(calls[0].key).toContain("documents/org/ws/");
    expect((calls[0].options as {customMetadata:{sourceSnapshotHash:string}}).customMetadata.sourceSnapshotHash).toBe("a".repeat(64));
  });
});
