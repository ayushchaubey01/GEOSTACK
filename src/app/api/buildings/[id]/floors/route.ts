import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
function lb() { if (!_c) { _c = JSON.parse(readFileSync(join(process.cwd(), "public/data/buildings.geojson"), "utf8")); } return _c; }
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fc = lb();
  const b = fc.features.find((f:any)=>f.properties.object_uuid===id||f.properties.display_code===id);
  if (!b) return NextResponse.json({error:"Building not found",id},{status:404});
  const p = b.properties; const fl = p.floors||1; const h = p.height_m||0;
  const groundElev = p.ground_elevation_m || 0;
  const fh = fl>0 ? h/fl : 0; const ps = p.parent_parcel_seq; const bs = p.building_seq;
  const fr = [];
  for (let f=1; f<=fl; f++) {
    const sign = f>=0?"+":"-"; const abs = Math.abs(f);
    const code = ps&&bs ? `BLR-P-${String(ps).padStart(6,"0")}-B-${String(bs).padStart(3,"0")}-F+${String(abs).padStart(2,"0")}-R-U-001` : null;
    fr.push({floor_number:f,floor_label:f===1?"Ground":f===2?"1st":f===3?"2nd":`${f-1}th`,elevation_m:Math.round((groundElev + fh*(f-1))*100)/100,ceiling_m:Math.round((groundElev + fh*f)*100)/100,floor_height_m:Math.round(fh*100)/100,ground_elevation_m:groundElev,floor_display_code:code,use_class:"R (Residential — placeholder)",unit_count:1,unit_uuid:null,source:"DERIVED",is_estimated:true,confidence_score:p.floors_confidence||0.4,legal_status:"PROVISIONAL_ESTIMATE"});
  }
  return NextResponse.json({building:{object_uuid:p.object_uuid,display_code:p.display_code,parent_parcel_uuid:p.parent_parcel_uuid,parent_parcel_code:p.parent_parcel_code,height_m:h,height_source:p.height_source,ground_elevation_m:groundElev,ground_elevation_source:p.ground_elevation_source,floors:fl,floors_source:p.floors_source,floors_estimated:p.floors_estimated,floors_confidence:p.floors_confidence,match_status:p.match_status,overlap_percent:p.overlap_percent},floors:fr,metadata:{note:"Phase 1 has no official floor plans. All floor divisions are derived estimates. Ground elevation from Copernicus DEM GLO-30 (DSM).",floor_height_assumption_m:3.5,legal_status:"PROVISIONAL_ESTIMATE",id_note:"Floor-level prototype IDs follow D.2 scheme. NOT official ULPINs."}});
}
