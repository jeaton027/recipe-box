import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Append a labeled example to the AI-recipe-parser dataset.
 *
 * Local-only dev tool: writes to a hardcoded sibling repo path so the
 * recipe-box dev server doubles as a labeling UI for the parser project.
 * Override with AI_RECIPE_DATASET_PATH if your layout differs.
 */

function resolveDatasetPath(): string {
  const env = process.env.AI_RECIPE_DATASET_PATH;
  if (env) return path.resolve(env);
  return path.resolve(
    process.cwd(),
    "..",
    "..",
    "AI-recipe-parser",
    "data",
    "dataset.json"
  );
}

type SavePayload = {
  input: string;
  expected: unknown;
  bucket?: string | null;
  source_url?: string | null;
};

export async function POST(req: NextRequest) {
  let body: SavePayload;
  try {
    body = (await req.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body.input !== "string" || !body.input.trim()) {
    return NextResponse.json({ error: "input (string) required" }, { status: 400 });
  }
  if (body.expected === undefined || body.expected === null) {
    return NextResponse.json({ error: "expected required" }, { status: 400 });
  }

  const datasetPath = resolveDatasetPath();
  let existing: unknown[] = [];
  try {
    const raw = await fs.readFile(datasetPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: `Dataset at ${datasetPath} is not an array` },
        { status: 500 }
      );
    }
    existing = parsed;
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      return NextResponse.json(
        { error: `Failed to read dataset: ${(e as Error).message}` },
        { status: 500 }
      );
    }
    // ENOENT is fine — we'll create the file.
  }

  const entry: Record<string, unknown> = {
    input: body.input,
    expected: body.expected,
  };
  if (body.bucket) entry.bucket = body.bucket;
  if (body.source_url) entry.source_url = body.source_url;

  existing.push(entry);
  await fs.mkdir(path.dirname(datasetPath), { recursive: true });
  await fs.writeFile(datasetPath, JSON.stringify(existing, null, 2) + "\n");

  return NextResponse.json({
    ok: true,
    count: existing.length,
    path: datasetPath,
  });
}
