import { redirect } from "next/navigation";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = searchParams ? await searchParams : {};
  const section = typeof params.section === "string" && params.section ? params.section : "overview";
  redirect(`/dashboard/reports/${section}`);
}