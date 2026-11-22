// Fill the gap between the latest page and the messages already on screen.
// Cursors are opaque and newest-first; callers retain the returned cursor if
// the safety bound is reached, so older pages remain available to the user.
export async function catchUpChat<T extends {id:string}>(first:T[], cursor:string, known:T[], fetchPage:(cursor:string)=>Promise<{items:T[];next_cursor?:string}>, maxPages=8):Promise<{items:T[];cursor:string;bridged:boolean}> {
 const ids=new Set(known.map(item=>item.id));
 let items=first.slice(), next=cursor, pages=1;
 // With no persisted anchor (for example after the app was killed), load a
 // bounded initial window and leave the cursor available for older history.
 if(!ids.size){const visited=new Set<string>();while(next&&pages<Math.min(maxPages,4)){if(visited.has(next))throw new Error('Chat history could not be refreshed. Please retry.');visited.add(next);const page=await fetchPage(next);items=items.concat(page.items||[]);next=page.next_cursor||'';pages++;}return {items,cursor:next,bridged:true};}
 const visited=new Set<string>();
 while(!items.some(item=>ids.has(item.id))&&next&&pages<maxPages){
  if(visited.has(next))throw new Error('Chat history could not be refreshed. Please retry.');
  visited.add(next);const page=await fetchPage(next);
  items=items.concat(page.items||[]);next=page.next_cursor||'';pages++;
 }
 return {items,cursor:next,bridged:items.some(item=>ids.has(item.id))||!next};
}
