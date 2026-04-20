"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ItemPickerOverlay, {
  type PickerItem,
} from "@/components/shared/ItemPickerOverlay";
import type { CourseType } from "./MenuRecipePicker";

type Menu = {
  id: string;
  name: string;
  cover_image_url: string | null;
};

const courseOptions: { label: string; value: CourseType }[] = [
  { label: "Main", value: "main" },
  { label: "Side", value: "side" },
  { label: "Starter", value: "starter" },
  { label: "Drink", value: "drink" },
  { label: "Dessert", value: "dessert" },
  { label: "Other", value: "other" },
];

type Props = {
  recipeId: string;
  recipeThumbnail?: string | null;
  /** Render-prop trigger. If omitted, a default button is rendered. */
  trigger?: (open: () => void) => React.ReactNode;
  /** Externally controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function AddToMenuButton({
  recipeId,
  recipeThumbnail,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const supabase = createClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const [menus, setMenus] = useState<Menu[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<CourseType>("main");

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const [{ data: ms }, { data: memberships }] = await Promise.all([
        supabase
          .from("menus")
          .select("id, name, cover_image_url")
          .order("name"),
        supabase
          .from("menu_recipes")
          .select("menu_id")
          .eq("recipe_id", recipeId),
      ]);
      setMenus(ms ?? []);
      setMemberOf(new Set(memberships?.map((m) => m.menu_id) ?? []));
      setLoading(false);
    }
    load();
  }, [open, recipeId, supabase]);

  async function toggleMenu(menuId: string) {
    const wasMember = memberOf.has(menuId);
    setMemberOf((prev) => {
      const next = new Set(prev);
      if (wasMember) next.delete(menuId);
      else next.add(menuId);
      return next;
    });

    if (wasMember) {
      await supabase
        .from("menu_recipes")
        .delete()
        .eq("menu_id", menuId)
        .eq("recipe_id", recipeId);
    } else {
      await supabase
        .from("menu_recipes")
        .insert({ menu_id: menuId, recipe_id: recipeId, course });
    }
  }

  async function createMenu(name: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newMenu, error } = await supabase
      .from("menus")
      .insert({
        user_id: user.id,
        name,
        cover_image_url: recipeThumbnail || null,
      })
      .select("id, name, cover_image_url")
      .single();

    if (error || !newMenu) return;

    await supabase
      .from("menu_recipes")
      .insert({ menu_id: newMenu.id, recipe_id: recipeId, course });

    setMenus((prev) => [...prev, newMenu]);
    setMemberOf((prev) => new Set(prev).add(newMenu.id));
  }

  const items: PickerItem[] = menus.map((m) => ({
    id: m.id,
    name: m.name,
    imageUrl: m.cover_image_url,
  }));

  const courseDropdown = (
    <div className="relative shrink-0">
      <label className="sr-only" htmlFor="add-to-menu-course">
        Course
      </label>
      <select
        id="add-to-menu-course"
        value={course}
        onChange={(e) => setCourse(e.target.value as CourseType)}
        className="rounded-md border border-border bg-background py-1.5 pl-3 pr-8 text-sm font-medium focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {courseOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add to menu
        </button>
      )}

      <ItemPickerOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="Add to Menu"
        items={items}
        loading={loading}
        memberIds={memberOf}
        onToggle={toggleMenu}
        newItemLabel="New Menu"
        newItemPlaceholder="Menu name..."
        onCreateItem={createMenu}
        headerMiddle={courseDropdown}
        emptyText="No menus yet."
      />
    </>
  );
}
