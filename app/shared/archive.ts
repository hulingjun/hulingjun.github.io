export const REPO = "hulingjun/hulingjun.github.io";
export const UPLOAD_ART = "https://github.com/" + REPO + "/issues/new?template=artwork.yml";
export const NEW_NOTE = "https://github.com/" + REPO + "/issues/new?template=growth.yml";
export const NEW_KNOWLEDGE = "https://github.com/" + REPO + "/issues/new?template=knowledge.yml";
export type Artwork = { id:number; title:string; date:string|null; story:string; image:string; thumbnail:string; width:number; height:number; sourceUrl:string };
export type KnowledgeRecord = { id:string; title:string; nodeCount:number; date:string; issue:number; path:string };
export type JournalRecord = { id:number; title:string; date:string; scope:"mine"|"daughter"; content:string; sourceUrl:string };
export type Archive = {version:1; knowledge:KnowledgeRecord[]; journal:JournalRecord[]};
export const EMPTY_ARCHIVE:Archive={version:1,knowledge:[],journal:[]};
export async function getJson<T>(url:string, signal?:AbortSignal):Promise<T> {
  const response=await fetch(url,{signal,cache:"no-cache"});
  if(!response.ok) throw new Error("记录暂时无法载入，请稍后重试。");
  return response.json();
}
