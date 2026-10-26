export type ChatTextPart={text:string;url?:string};
export function chatTextParts(text:string):ChatTextPart[]{
 const parts:ChatTextPart[]=[];let offset=0;
 const matcher=/(?:https?:\/\/|www\.)[^\s<>"\u0000-\u001f]+/gi;
 for(const match of text.matchAll(matcher)){
  const start=match.index!;let label=match[0].replace(/[.,!?;:]+$/,'');
  for(const [open,close] of [['(',')'],['[',']'],['{','}']])while(label.endsWith(close)&&label.split(close).length>label.split(open).length)label=label.slice(0,-1);
  let url:string|undefined;
  try{const parsed=new URL(/^www\./i.test(label)?'https://'+label:label);if(['http:','https:'].includes(parsed.protocol)&&parsed.hostname&&!parsed.username&&!parsed.password)url=parsed.href;}catch{}
  if(start>offset)parts.push({text:text.slice(offset,start)});
  parts.push({text:label,...(url?{url}:{})});offset=start+label.length;
 }
 if(offset<text.length)parts.push({text:text.slice(offset)});
 return parts;
}
