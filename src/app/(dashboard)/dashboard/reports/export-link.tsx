import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ExportLink({ from, to }: { from: string; to: string }) {
  return <Link href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}><Button type="button" variant="secondary">Export CSV</Button></Link>;
}
