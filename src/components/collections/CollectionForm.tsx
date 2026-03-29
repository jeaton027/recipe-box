"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import type { Collection } from "@/lib/types/database";

type Props = {
  collection?: Collection;
};

export default function CollectionForm({ collection }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!collection;

  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(collection?.cover_image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCoverUpload(file: File): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/collections/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(filePath, file);

    if (error) return null;

    const { data: { publicUrl } } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(filePath);

    setCoverImageUrl(publicUrl);
    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in"); setSaving(false); return; }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      cover_image_url: coverImageUrl || null,
    };

    if (isEditing && collection) {
      const { error } = await supabase
        .from("collections")
        .update(payload)
        .eq("id", collection.id);

      if (error) { setError(error.message); setSaving(false); return; }
      router.push(`/collections/${collection.id}`);
    } else {
      const { data, error } = await supabase
        .from("collections")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) { setError(error?.message ?? "Failed to create"); setSaving(false); return; }
      router.push(`/collections/${data.id}`);
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="e.g. Thanksgiving 2025, Weeknight rotation"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="What's this collection for?"
        />
      </div>

      <ImageUpload
        currentUrl={coverImageUrl || null}
        onUpload={handleCoverUpload}
        onRemove={() => setCoverImageUrl("")}
        label="Cover image"
      />

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {saving ? "Saving..." : isEditing ? "Update collection" : "Create collection"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
