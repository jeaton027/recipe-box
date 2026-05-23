async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const mod: any = await import("../src/lib/parsers/recipe");
const parseRecipeText: (text: string) => unknown =
  mod.parseRecipeText ?? mod.default?.parseRecipeText;

if (typeof parseRecipeText !== "function") {
  process.stderr.write(
    "parse-recipe-cli: failed to locate parseRecipeText export. " +
      "Module keys: " +
      JSON.stringify(Object.keys(mod)) +
      "\n"
  );
  process.exit(1);
}

const text = await readStdin();
const result = parseRecipeText(text);
process.stdout.write(JSON.stringify(result));
