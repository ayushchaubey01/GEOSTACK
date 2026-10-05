import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
function lr() { if (!_c) { _c = JSON.parse(readFileSync(join(process.cwd(), "public/data/roads.geojson"), "utf8")); } return _c; }
export async function GET(req: NextRequest) {
  const u = req.nextUrl, b = u.searchParams.get("bbox"), l = u.searchParams.get("limit");
  const lim = Math.max(1, Math.min(l ? parseInt(l,10) || 5000 : 5000, 50000));
  const fc = lr(); let f = fc.features;
  if (b) { const p = b.split(",").map(parseFloat);
    if (p.length!==4||p.some(isNaN)) return NextResponse.json({error:"Invalid bbox"},{status:400});
    const [w,s,e,n] = p; f = f.filter((x:any)=>{const c=x.geometry.coordinates[0];return c[0]>=w&&c[0]<=e&&c[1]>=s&&c[1]<=n;}); }
  const t = f.length; f = f.slice(0, lim);
  return NextResponse.json({type:"FeatureCollection",features:f,metadata:{total:t,returned:f.length,truncated:t>f.length,limit:lim,bbox:b||null,crs:"EPSG:4326",data_source:"OpenStreetMap (BBBike) - (c) OpenStreetMap contributors, ODbL"}});
}
