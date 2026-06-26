import { NextResponse } from "next/server";

/** JSON response with edge-cache + stale-while-revalidate headers. */
export function jsonOk<T>(data: T, sMaxAge: number): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 6}`,
    },
  });
}

export function jsonError(message: string, status = 502, detail?: string): NextResponse {
  return NextResponse.json({ error: message, detail }, { status });
}
