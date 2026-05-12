import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformSession } from "@/lib/platformAuth";
import {
  isVendorTemplateType,
  resolveVendorTemplate,
  sampleVarsFor,
} from "@/lib/email/vendorTemplates";
import EmailTemplateEditor from "./EmailTemplateEditor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ type: string }> };

export default async function PlatformEmailTemplateEditorPage({ params }: PageProps) {
  await requirePlatformSession();
  const { type } = await params;
  if (!isVendorTemplateType(type)) notFound();

  const resolved = await resolveVendorTemplate(type);
  const sampleVars = sampleVarsFor(type);

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link className="text-xs text-slate-500 hover:text-red-600 hover:underline" href="/platform/email-templates">
            ← Svi predlošci
          </Link>
          <h1 className="mt-1 text-3xl font-bold">{resolved.def.label}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{resolved.def.description}</p>
        </div>
      </div>

      <EmailTemplateEditor
        type={type}
        initialFields={resolved.fields}
        defaults={resolved.def.fields}
        variables={resolved.def.variables}
        sampleVars={sampleVars}
        hasOverride={resolved.override !== null}
      />
    </main>
  );
}
