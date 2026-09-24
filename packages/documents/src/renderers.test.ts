import { describe, expect, it } from "vitest";
import { createDefaultDocumentRendererRegistry, createDocumentRendererRegistry, renderDocument, type DocumentRenderer } from "./renderers";

const document={metadata:{documentType:"report",title:"Report",generatedAt:"2026-09-24T12:00:00.000Z",sourceCapability:"CAP.REPORT.READ@1",resourceScope:"report:r1",organizationId:"org_1",workspaceId:"ws_1",actorId:"user_1"},locale:"en-US",timezone:"UTC",calendar:"gregorian" as const,template:{id:"report.default",version:1},header:[],sections:[{title:"Summary",blocks:["Hello"],tables:[{columns:["A","B"],rows:[["1","2"]]}]}],footer:[],attachments:[],provenance:{},integrity:{snapshotHash:"a".repeat(64)}};

describe("document renderers",()=>{
  it("renders a concrete PDF artifact",async()=>{
    const artifact=await renderDocument(document,{id:"default",version:1,locale:"en-US",timezone:"UTC",format:"pdf"},createDefaultDocumentRendererRegistry());
    expect(artifact.mediaType).toBe("application/pdf");
    expect(new TextDecoder().decode(artifact.bytes).startsWith("%PDF-1.4")).toBe(true);
    expect(artifact.sourceSnapshotHash).toBe(document.integrity.snapshotHash);
  });
  it("renders a Unicode-safe print HTML artifact",async()=>{
    const artifact=await renderDocument(document,{id:"default",version:1,locale:"fa-IR",timezone:"Asia/Tehran",format:"print"},createDefaultDocumentRendererRegistry());
    expect(artifact.mediaType).toContain("text/html");
    expect(new TextDecoder().decode(artifact.bytes)).toContain("<meta charset=\"utf-8\">");
  });
  it("fails closed without renderer",async()=>{
    const renderer:DocumentRenderer={rendererId:"test.pdf",version:1,format:"pdf",async render(doc){return{format:"pdf",mediaType:"application/pdf",filename:"report.pdf",bytes:new Uint8Array([1,2,3]),sourceSnapshotHash:doc.integrity.snapshotHash,rendererId:"test.pdf",rendererVersion:1};}};
    await expect(renderDocument(document,{id:"default",version:1,locale:"en-US",timezone:"UTC",format:"print"},createDocumentRendererRegistry([renderer]))).rejects.toThrow("No renderer");
  });
});
