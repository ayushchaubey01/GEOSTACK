import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
export async function GET() {
  if (_c) return NextResponse.json(_c);
  const raw = readFileSync(join(process.cwd(), "public/data/buildings.geojson"), "utf8");
  const fc = JSON.parse(raw); const b = fc.features;
  const n = (v:any) => { const x = Number(v); return isNaN(x) ? null : x; };
  const tallest = b.map((x:any)=>({code:x.properties.display_code,uuid:x.properties.object_uuid,height:n(x.properties.height_m),floors:n(x.properties.floors),coords:x.geometry.coordinates[0][0]})).filter((x:any)=>x.height!=null&&x.height>0).sort((a:any,b:any)=>b.height-a.height).slice(0,10);
  const bestMatched = b.map((x:any)=>({code:x.properties.display_code,uuid:x.properties.object_uuid,height:n(x.properties.height_m),confidence:n(x.properties.confidence_score),match:x.properties.match_status,heightMatch:x.properties.height_match_status,overlap:n(x.properties.overlap_percent),coords:x.geometry.coordinates[0][0]})).filter((x:any)=>x.match==="MATCHED_STRONG"&&x.heightMatch==="MATCHED_STRONG").sort((a:any,b:any)=>(b.confidence||0)-(a.confidence||0)).slice(0,10);
  const mostFloors = b.map((x:any)=>({code:x.properties.display_code,uuid:x.properties.object_uuid,floors:n(x.properties.floors),height:n(x.properties.height_m),coords:x.geometry.coordinates[0][0]})).filter((x:any)=>x.floors!=null&&x.floors>0).sort((a:any,b:any)=>b.floors-a.floors).slice(0,10);
  const hv = b.map((x:any)=>n(x.properties.height_m)).filter((v:any)=>v!=null&&v>0).sort((a:number,b:number)=>a-b);
  const med = hv.length>0 ? hv[Math.floor(hv.length/2)] : 0;
  const mean = hv.length>0 ? hv.reduce((s:number,v:number)=>s+v,0)/hv.length : 0;
  _c = {tallest,bestMatched,mostFloors,summary:{total_buildings:b.length,median_height:Math.round(med*100)/100,mean_height:Math.round(mean*100)/100,max_height:tallest[0]?.height||0,max_floors:mostFloors[0]?.floors||0}};
  return NextResponse.json(_c);
}
