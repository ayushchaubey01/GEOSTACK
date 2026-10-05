import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
let _c: any = null;
export async function GET() { if (!_c) { _c = JSON.parse(readFileSync(join(process.cwd(), "public/data/stats.json"), "utf8")); } return NextResponse.json(_c); }
