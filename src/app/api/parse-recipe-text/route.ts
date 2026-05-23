import { NextRequest, NextResponse } from "next/server";
import { parseRecipeText } from "@/lib/parsers/recipe";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  return NextResponse.json(parseRecipeText(text));
}
