import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
function li() { if (!_c) { _c = JSON.parse(readFileSync(join(process.cwd(), "public/data/validation_issues.json"), "utf8")); } return _c; }
export async function GET(req: NextRequest) {
  const u = req.nextUrl; const sv = u.searchParams.get("severity"); const ty = u.searchParams.get("type");
  const l = u.searchParams.get("limit"); const lim = Math.max(1, Math.min(l ? parseInt(l,10) || 200 : 200, 50000));
  const d = li(); let is = d.issues;
  if (sv) is = is.filter((i:any)=>i.severity===sv);
  if (ty) is = is.filter((i:any)=>i.issue_type===ty);
  const t = is.length; is = is.slice(0, lim);
  const sm: Record<string, number> = {};
  for (const i of d.issues) { const k = `${i.severity}:${i.issue_type}`; sm[k] = (sm[k]||0)+1; }
  return NextResponse.json({issues:is,count:is.length,total_in_dataset:d.count,truncated:t>is.length,summary:sm,metadata:{note:"Phase 1 validation flags. NOT a legal audit."}});
}
