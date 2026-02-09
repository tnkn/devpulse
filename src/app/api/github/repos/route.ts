import { NextRequest, NextResponse } from "next/server";
import { listRepositories } from "@/lib/github";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("per_page") || "20", 10);
  const query = searchParams.get("q") || undefined;

  try {
    const result = await listRepositories(page, perPage, query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("GITHUB_TOKEN")) {
      return NextResponse.json({ error: "GITHUB_TOKEN is not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
