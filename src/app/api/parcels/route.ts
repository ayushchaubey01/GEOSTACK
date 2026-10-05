import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
function lp() { if (!_c) { _c = JSON.parse(readFileSync(join(process.cwd(), "public/data/parcels.geojson"), "utf8")); } return _c; }
export async function GET(req: NextRequest) {
  const u = req.nextUrl, b = u.searchParams.get("bbox"), l = u.searchParams.get("limit");
  const lim = Math.max(1, Math.min(l ? parseInt(l,10) || 5000 : 5000, 50000));
  const fc = lp(); let f = fc.features;
  if (b) { const parts = b.split(",").map(parseFloat);
    if (parts.length !== 4 || parts.some(isNaN)) return NextResponse.json({error:"Invalid bbox"},{status:400});
    const [w,s,e,n] = parts;
    f = f.filter((x:any)=>{const r=x.geometry.coordinates[0][0];return r[0]>=w&&r[0]<=e&&r[1]>=s&&r[1]<=n;}); }
  const t = f.length; f = f.slice(0, lim);
  return NextResponse.json({type:"FeatureCollection",features:f,metadata:{total:t,returned:f.length,truncated:t>f.length,limit:lim,bbox:b||null,crs:"EPSG:4326",data_source:"BBMP Cadastral (KSRSAC via OpenCity)",legal_status:"UNVERIFIED",id_note:"Prototype internal IDs - NOT official government ULPINs."}});
}
