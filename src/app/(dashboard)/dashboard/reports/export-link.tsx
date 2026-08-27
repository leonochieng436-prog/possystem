import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ExportLink({ from, to, type = "report", label = "Export CSV" }: { from?: string; to?: string; type?: "report" | "inventory" | "products"; label?: string }) {
  const params = new URLSearchParams({ type });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return <Link href={`/api/exports?${params.toString()}`}><Button type="button" variant="secondary">{label}</Button></Link>;
}
