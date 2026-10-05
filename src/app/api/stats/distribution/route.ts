import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _b: any = null, _p: any = null, _c: any = null;
function lb() { if (!_b) { _b = JSON.parse(readFileSync(join(process.cwd(), "public/data/buildings.geojson"), "utf8")); } return _b; }
function lp() { if (!_p) { _p = JSON.parse(readFileSync(join(process.cwd(), "public/data/parcels.geojson"), "utf8")); } return _p; }
export async function GET() {
  if (_c) return NextResponse.json(_c);
  const bld = lb(), parcels = lp();
  const hb = [{range:"0-5m",min:0,max:5,count:0},{range:"5-10m",min:5,max:10,count:0},{range:"10-15m",min:10,max:15,count:0},{range:"15-20m",min:15,max:20,count:0},{range:"20-30m",min:20,max:30,count:0},{range:"30-40m",min:30,max:40,count:0},{range:"40-55m",min:40,max:55,count:0},{range:"55-70m",min:55,max:70,count:0},{range:"70-90m",min:70,max:90,count:0},{range:"90m+",min:90,max:Infinity,count:0}];
  let nh = 0;
  for (const f of bld.features) { const h = Number(f.properties.height_m); if (isNaN(h)||h<=0) { nh++; continue; } for (const b of hb) { if (h>=b.min&&h<b.max) { b.count++; break; } } }
  const fb = [{range:"1 (G)",min:1,max:2,count:0},{range:"2-3",min:2,max:4,count:0},{range:"4-6",min:4,max:7,count:0},{range:"7-9",min:7,max:10,count:0},{range:"10-15",min:10,max:16,count:0},{range:"16-20",min:16,max:21,count:0},{range:"20+",min:20,max:Infinity,count:0}];
  for (const f of bld.features) { const fl = Number(f.properties.floors); if (isNaN(fl)||fl<=0) continue; for (const b of fb) { if (fl>=b.min&&fl<b.max) { b.count++; break; } } }
  const ms = {MATCHED_STRONG:0,MATCHED_WEAK:0,MATCHED_MARGINAL:0,CROSSES_MULTIPLE_PARCELS:0,OUTSIDE_ALL_PARCELS:0};
  for (const f of bld.features) { const s = f.properties.match_status; if (s in ms) ms[s]++; }
  const hms = {MATCHED_STRONG:0,MATCHED_WEAK:0,MATCHED_MARGINAL:0,NO_GLOBFP_MATCH:0};
  for (const f of bld.features) { const s = f.properties.height_match_status; if (s in hms) hms[s]++; }
  const cb = [{range:"0-20%",min:0,max:0.2,count:0,color:"#dc2626"},{range:"20-40%",min:0.2,max:0.4,count:0,color:"#f97316"},{range:"40-60%",min:0.4,max:0.6,count:0,color:"#facc15"},{range:"60-80%",min:0.6,max:0.8,count:0,color:"#84cc16"},{range:"80-100%",min:0.8,max:1.01,count:0,color:"#10b981"}];
  for (const f of bld.features) { const c = Number(f.properties.confidence_score); if (isNaN(c)) continue; for (const b of cb) { if (c>=b.min&&c<b.max) { b.count++; break; } } }
  const ir = JSON.parse(readFileSync(join(process.cwd(), "public/data/validation_issues.json"), "utf8"));
  const itc: Record<string, number> = {};
  for (const i of ir.issues) { itc[i.issue_type] = (itc[i.issue_type]||0)+1; }
  const it = Object.entries(itc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([type,count])=>({type:type.replace(/_/g," "),count}));
  _c = {height_histogram:hb.map(b=>({range:b.range,count:b.count})),no_height_count:nh,floors_distribution:fb.map(b=>({range:b.range,count:b.count})),match_status:Object.entries(ms).map(([k,v])=>({label:k.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()),value:v})),height_match_status:Object.entries(hms).map(([k,v])=>({label:k.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()),value:v})),confidence_distribution:cb.map(b=>({range:b.range,count:b.count,color:b.color})),issue_types:it,totals:{buildings:bld.features.length,parcels:parcels.features.length,buildings_with_height:bld.features.filter((f:any)=>f.properties.height_m!=null).length}};
  return NextResponse.json(_c);
}
