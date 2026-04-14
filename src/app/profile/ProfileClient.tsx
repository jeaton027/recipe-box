"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tag, TagCategory } from "@/lib/types/database";
import { categoryLabels, categoryOrder } from "@/lib/utils/tag-helpers";

type Props = {
  email: string;
  recipeCount: number;
  collectionCount: number;
  tags: Tag[];
};

export default function ProfileClient({
  email,
  recipeCount,
  collectionCount,
  tags: initialTags,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Tag management
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>("custom");
  const [showNewTag, setShowNewTag] = useState(false);
  const [tagMsg, setTagMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tagEditMode, setTagEditMode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handlePasswordChange() {
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordMsg({ type: "error", text: error.message });
    } else {
      setPasswordMsg({ type: "success", text: "Password updated." });
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    }
  }

  // Tag CRUD
  async function handleRenameTag(tagId: string) {
    if (!editingTagName.trim()) return;
    const { error } = await supabase
      .from("tags")
      .update({ name: editingTagName.trim() })
      .eq("id", tagId);
    if (error) {
      setTagMsg({ type: "error", text: error.message });
    } else {
      setTags((prev) =>
        prev.map((t) => (t.id === tagId ? { ...t, name: editingTagName.trim() } : t))
      );
      setEditingTagId(null);
      setEditingTagName("");
    }
  }

  async function handleDeleteTag(tagId: string) {
    // Remove from recipe_tags first, then delete tag
    await supabase.from("recipe_tags").delete().eq("tag_id", tagId);
    const { error } = await supabase.from("tags").delete().eq("id", tagId);
    if (error) {
      setTagMsg({ type: "error", text: error.message });
    } else {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name: newTagName.trim(), category: newTagCategory })
      .select("*")
      .single();

    if (error) {
      setTagMsg({ type: "error", text: error.message });
    } else if (data) {
      setTags((prev) => [...prev, data]);
      setNewTagName("");
      setShowNewTag(false);
    }
  }

  // Group tags by category
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  const orderedCategories = categoryOrder.filter(
    (cat) => tagsByCategory[cat]?.length > 0
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-8 text-2xl font-bold tracking-tight">
        Profile
      </h1>

      {/* Account info */}
      <section className="mb-8 rounded-lg border border-border bg-white p-5">
        <h2 className="font-heading mb-3 text-lg font-semibold">Account</h2>
        <p className="text-sm text-muted">{email}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span>
            <strong className="text-foreground">{recipeCount}</strong>{" "}
            <span className="text-muted">{recipeCount === 1 ? "recipe" : "recipes"}</span>
          </span>
          <span>
            <strong className="text-foreground">{collectionCount}</strong>{" "}
            <span className="text-muted">{collectionCount === 1 ? "collection" : "collections"}</span>
          </span>
        </div>

        {/* Password */}
        <div className="mt-4 border-t border-border pt-4">
          {showPassword ? (
            <div className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.type === "error" ? "text-red-500" : "text-green-600"}`}>
                  {passwordMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handlePasswordChange}
                  disabled={savingPassword}
                  className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                >
                  {savingPassword ? "Saving..." : "Update Password"}
                </button>
                <button
                  onClick={() => {
                    setShowPassword(false);
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordMsg(null);
                  }}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPassword(true)}
              className="text-sm font-medium text-accent hover:text-accent-dark"
            >
              Change password
            </button>
          )}
        </div>

        {/* Sign out */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-red-500 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* Manage Tags */}
      <section className="mb-8 rounded-lg border border-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-lg font-semibold">Manage Tags</h2>
            {!tagEditMode && (
              <button
                onClick={() => {
                  setTagEditMode(true);
                  setShowNewTag(false);
                }}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Edit
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tagEditMode ? (
              <>
                <button
                  onClick={() => {
                    setTagEditMode(false);
                    setConfirmDeleteId(null);
                    setEditingTagId(null);
                    setEditingTagName("");
                  }}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setTagEditMode(false);
                    setConfirmDeleteId(null);
                    setEditingTagId(null);
                    setEditingTagName("");
                  }}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowNewTag((v) => !v)}
                  className="text-sm font-medium text-accent hover:text-accent-dark"
                >
                  {showNewTag ? "Cancel" : "+ New Tag"}
                </button>
              </>
            )}
          </div>
        </div>

        {tagMsg && (
          <p className={`mb-3 text-sm ${tagMsg.type === "error" ? "text-red-500" : "text-green-600"}`}>
            {tagMsg.text}
          </p>
        )}

        {/* New tag form */}
        {showNewTag && !tagEditMode && (
          <div className="mb-4 rounded-md bg-accent-light/30 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); }}
                placeholder="Tag name"
                autoFocus
                className="flex-1 rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <select
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value as TagCategory)}
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {categoryOrder.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Tag list grouped by category */}
        {orderedCategories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No tags yet.</p>
        ) : (
          <div className="space-y-5">
            {orderedCategories.map((category) => (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {categoryLabels[category]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tagsByCategory[category].map((tag) => (
                    <div key={tag.id} className="group relative">
                      {editingTagId === tag.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameTag(tag.id);
                              if (e.key === "Escape") { setEditingTagId(null); setEditingTagName(""); }
                            }}
                            autoFocus
                            className="w-28 rounded-md border border-accent bg-white px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          <button
                            onClick={() => handleRenameTag(tag.id)}
                            className="text-xs text-accent hover:text-accent-dark"
                          >
                            Save
                          </button>
                        </div>
                      ) : confirmDeleteId === tag.id ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                          Delete &ldquo;{tag.name}&rdquo;?
                          <button
                            onClick={() => {
                              handleDeleteTag(tag.id);
                              setConfirmDeleteId(null);
                            }}
                            className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-600"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-red-400 hover:text-red-600"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark"
                        >
                          {tagEditMode ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingTagId(tag.id);
                                  setEditingTagName(tag.name);
                                }}
                                className="hover:underline"
                              >
                                {tag.name}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(tag.id)}
                                className="ml-0.5 text-accent-dark/40 hover:text-red-500"
                                title="Delete tag"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <span>{tag.name}</span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="font-heading mb-3 text-lg font-semibold">About</h2>
        <p className="text-sm text-muted leading-relaxed">
          Recipe Box is a personal recipe organizer built with Next.js, Supabase, and Tailwind CSS.
          Import recipes from URLs, paste text, or create them from scratch.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full bg-accent-light/50 px-2 py-0.5">Next.js</span>
          <span className="rounded-full bg-accent-light/50 px-2 py-0.5">Supabase</span>
          <span className="rounded-full bg-accent-light/50 px-2 py-0.5">Tailwind CSS</span>
          <span className="rounded-full bg-accent-light/50 px-2 py-0.5">TypeScript</span>
        </div>
      </section>
    </div>
  );
}
