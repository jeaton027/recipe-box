import CollectionForm from "@/components/collections/CollectionForm";

export default function NewCollectionPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl font-bold tracking-tight">
        New Collection
      </h1>
      <CollectionForm />
    </div>
  );
}
