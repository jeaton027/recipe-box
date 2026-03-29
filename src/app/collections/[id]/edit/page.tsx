import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CollectionForm from "@/components/collections/CollectionForm";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (!collection) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl font-bold tracking-tight">
        Edit Collection
      </h1>
      <CollectionForm collection={collection} />
    </div>
  );
}
