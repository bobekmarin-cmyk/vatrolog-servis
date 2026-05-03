import { redirect } from "next/navigation";

export default async function AdminServicersPage() {
  redirect("/admin/settings/servicers");
}
