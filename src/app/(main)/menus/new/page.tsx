import MenuForm from "@/components/menus/MenuForm";

export default function NewMenuPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl font-bold tracking-tight">
        New Menu
      </h1>
      <MenuForm />
    </div>
  );
}
