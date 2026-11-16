import {Image as CompressorImage} from 'react-native-compressor';
import {File} from 'expo-file-system';
export async function prepareListingPhoto(input:{uri:string;mimeType?:string|null;fileSize?:number|null}) {
 if(!/^(file|content|ph):\/\//i.test(input.uri))throw Error('Choose a photo from your phone.');
 const uri=await CompressorImage.compress(input.uri,{compressionMethod:'manual',maxWidth:2048,maxHeight:2048,quality:.85,output:input.mimeType==='image/png'?'png':'jpg',returnableOutputType:'uri'});
 const cleanup=()=>{if(uri!==input.uri&&uri.startsWith('file://'))try{const file=new File(uri);if(file.exists)file.delete();}catch{}};
 const size=new File(uri).size;
 if(!Number.isFinite(size)||size<=0||size>10*1024*1024){cleanup();throw Error('The prepared photo must be smaller than 10 MiB. Please crop it and retry.');}
 return {uri,fileName:input.mimeType==='image/png'?'listing.png':'listing.jpg',mimeType:input.mimeType==='image/png'?'image/png':'image/jpeg',fileSize:size,cleanup};
}
