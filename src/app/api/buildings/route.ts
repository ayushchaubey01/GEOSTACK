import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
function lb() { if (!_c) { _c = JSON.parse(readFileSync(join(process.cwd(), "public/data/buildings.geojson"), "utf8")); } return _c; }
export async function GET(req: NextRequest) {
  const u = req.nextUrl, b = u.searchParams.get("bbox"), l = u.searchParams.get("limit");
  const lim = Math.max(1, Math.min(l ? parseInt(l,10) || 8000 : 8000, 50000));
  const ms = u.searchParams.get("match_status"), wh = u.searchParams.get("with_height")==="1";
  const ppu = u.searchParams.get("parent_parcel_uuid"), pps = u.searchParams.get("parent_parcel_seq");
  const ou = u.searchParams.get("object_uuid"), dc = u.searchParams.get("display_code");
  const mf = u.searchParams.get("min_floors"), xf = u.searchParams.get("max_floors");
  const fc = lb(); let f = fc.features;
  if (ou) f = f.filter((x:any)=>x.properties.object_uuid===ou);
  if (dc) f = f.filter((x:any)=>x.properties.display_code===dc);
  if (ppu) f = f.filter((x:any)=>x.properties.parent_parcel_uuid===ppu);
  if (pps) f = f.filter((x:any)=>String(x.properties.parent_parcel_seq)===String(pps));
  if (b) { const p = b.split(",").map(parseFloat);
    if (p.length!==4||p.some(isNaN)) return NextResponse.json({error:"Invalid bbox"},{status:400});
    const [w,s,e,n] = p; f = f.filter((x:any)=>{const r=x.geometry.coordinates[0][0];return r[0]>=w&&r[0]<=e&&r[1]>=s&&r[1]<=n;}); }
  if (ms) f = f.filter((x:any)=>x.properties.match_status===ms);
  if (wh) f = f.filter((x:any)=>x.properties.height_m!=null);
  if (mf) { const n=parseInt(mf,10); if(!isNaN(n)) f=f.filter((x:any)=>Number(x.properties.floors)>=n); }
  if (xf) { const n=parseInt(xf,10); if(!isNaN(n)) f=f.filter((x:any)=>Number(x.properties.floors)<=n); }
  const t = f.length; f = f.slice(0, lim);
  return NextResponse.json({type:"FeatureCollection",features:f,metadata:{total:t,returned:f.length,truncated:t>f.length,limit:lim,bbox:b||null,crs:"EPSG:4326",data_source:"OSM (BBBike) + 3D-GloBFP heights",legal_status:"UNVERIFIED",height_note:"Heights ML-estimated (3D-GloBFP, 2020), NOT surveyed.",floor_note:"Floor counts derived from height are ESTIMATES.",id_note:"Prototype IDs - NOT official ULPINs."}});
}
