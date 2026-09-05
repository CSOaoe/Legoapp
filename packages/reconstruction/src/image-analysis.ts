import type {SilhouetteProfile} from "./reconstruct";

export type AnalysedImage={profile:SilhouetteProfile;preview:string;foregroundHex:string;width:number;height:number};
const hex=(value:number)=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,"0");

export async function analyseImage(file:File,samples=96):Promise<AnalysedImage>{
 const bitmap=await createImageBitmap(file),sourceWidth=bitmap.width,sourceHeight=bitmap.height,scale=Math.min(samples/sourceWidth,samples/sourceHeight),width=Math.max(24,Math.round(sourceWidth*scale)),height=Math.max(24,Math.round(sourceHeight*scale)),canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("Image analysis is unavailable in this browser");context.drawImage(bitmap,0,0,width,height);bitmap.close();const pixels=context.getImageData(0,0,width,height).data;
 const edge:number[]=[];for(let x=0;x<width;x++)for(let y=0;y<Math.max(2,Math.round(height*.08));y++)edge.push((y*width+x)*4);for(let y=0;y<height;y++){edge.push((y*width)*4);edge.push((y*width+width-1)*4)}
 const background=[0,1,2].map(channel=>edge.reduce((sum,index)=>sum+pixels[index+channel],0)/edge.length),distance=(index:number)=>Math.hypot(pixels[index]-background[0],pixels[index+1]-background[1],pixels[index+2]-background[2]);
 const threshold=34,mask=new Uint8Array(width*height);let minX=width,maxX=0,minY=height,maxY=0,foreground=0,r=0,g=0,b=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const index=(y*width+x)*4;if(distance(index)>threshold){mask[y*width+x]=1;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);foreground++;r+=pixels[index];g+=pixels[index+1];b+=pixels[index+2]}}
 if(foreground<width*height*.015)throw new Error(`${file.name} does not contain enough contrast from its background`);
 const boxWidth=Math.max(1,maxX-minX+1),boxHeight=Math.max(1,maxY-minY+1),rows=Math.max(12,boxHeight),topDown:number[]=[],topDownOffsets:number[]=[];
 for(let row=0;row<rows;row++){const sourceY=Math.round(minY+(row/(rows-1))*(maxY-minY));let left=width,right=-1;for(let offset=-1;offset<=1;offset++){const y=Math.max(0,Math.min(height-1,sourceY+offset));for(let x=0;x<width;x++)if(mask[y*width+x]){left=Math.min(left,x);right=Math.max(right,x)}}topDown.push(right>=left?(right-left+1)/boxWidth:0);topDownOffsets.push(right>=left?((left+right)/2-(minX+maxX)/2)/boxWidth:0)}
 const smooth=(values:number[])=>values.map((value,index,array)=>{const previous=array[Math.max(0,index-1)],next=array[Math.min(array.length-1,index+1)];return(previous+value*2+next)/4});
 const widths=smooth(topDown.reverse()).map(value=>Math.max(0,Math.min(1,value))),offsets=smooth(topDownOffsets.reverse()).map(value=>Math.max(-.5,Math.min(.5,value)));
 const confidence=Math.max(0,Math.min(1,(foreground/(width*height))/.35))*.55+.45;
 return{profile:{widths,offsets,aspectRatio:boxWidth/boxHeight,confidence},preview:URL.createObjectURL(file),foregroundHex:`#${hex(r/foreground)}${hex(g/foreground)}${hex(b/foreground)}`,width:sourceWidth,height:sourceHeight};
}

export function mergeProfiles(profiles:SilhouetteProfile[]):SilhouetteProfile{
 if(!profiles.length)return{widths:[.5],offsets:[0],aspectRatio:.6,confidence:0};const length=Math.max(...profiles.map(profile=>profile.widths.length)),widths=Array.from({length},(_,index)=>profiles.reduce((sum,profile)=>{const at=Math.round(index/(length-1)*Math.max(0,profile.widths.length-1));return sum+(profile.widths[at]??0)},0)/profiles.length),offsets=Array.from({length},(_,index)=>profiles.reduce((sum,profile)=>{const at=Math.round(index/(length-1)*Math.max(0,profile.widths.length-1));return sum+(profile.offsets?.[at]??0)},0)/profiles.length);
 return{widths,offsets,aspectRatio:profiles.reduce((sum,profile)=>sum+(profile.aspectRatio??.6),0)/profiles.length,confidence:profiles.reduce((sum,profile)=>sum+profile.confidence,0)/profiles.length};
}
