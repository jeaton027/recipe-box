// server component shell
import ImportForm from "@/components/recipes/ImportForm";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-heading mb-2 text-2xl font-bold">Import Recipe</h1>
      <p className="mb-8 text-sm text-muted">
        Import from a URL or paste recipe text directly.
      </p>
      <ImportForm />
    </div>
  );
}
