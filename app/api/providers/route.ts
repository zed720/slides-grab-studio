import { NextResponse } from "next/server";
import { detectAll } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const providers = await detectAll();
  return NextResponse.json(
    { providers },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
