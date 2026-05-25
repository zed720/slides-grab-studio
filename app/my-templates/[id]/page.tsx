import { notFound } from "next/navigation";
import { MyTemplateBuilder } from "@/components/MyTemplateBuilder";
import { TopNav } from "@/components/TopNav";
import {
  getCustomTemplate,
  parseBrand,
} from "@/lib/db/queries/custom-templates";

export default async function EditMyTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tpl = getCustomTemplate(id);
  if (!tpl || tpl.deleted_at !== null) notFound();
  return (
    <>
      <TopNav />
      <MyTemplateBuilder
        templateId={tpl.id}
        initialName={tpl.name}
        initialBrand={parseBrand(tpl)}
      />
    </>
  );
}
