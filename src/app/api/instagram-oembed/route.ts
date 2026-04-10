import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    // Fetch the Instagram page HTML to extract og:image and author meta tags
    // (oEmbed thumbnail_url was deprecated by Meta in 2025)
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not fetch Instagram page. The post may be private." },
        { status: 422 }
      );
    }

    const html = await res.text();

    // Extract og:image
    const ogImageMatch = html.match(
      /<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i
    ) ?? html.match(
      /<meta\s+content="([^"]+)"\s+(?:property|name)="og:image"/i
    );
    const thumbnailUrl = ogImageMatch?.[1] ?? null;

    // Extract og:title or author from meta tags
    const ogTitleMatch = html.match(
      /<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i
    ) ?? html.match(
      /<meta\s+content="([^"]+)"\s+(?:property|name)="og:title"/i
    );
    const ogTitle = ogTitleMatch?.[1] ?? null;

    // Try to extract @username from the og:title (usually "Author on Instagram: ...")
    const authorMatch = ogTitle?.match(/^(.+?)\s+on\s+Instagram/i);
    const authorName = authorMatch?.[1] ?? null;

    return NextResponse.json({
      thumbnail_url: thumbnailUrl,
      author_name: authorName,
      title: ogTitle,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Instagram data" },
      { status: 500 }
    );
  }
}
