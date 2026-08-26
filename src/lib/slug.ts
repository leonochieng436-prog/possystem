export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function uniqueOrgSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base) || "business";
  let candidate = root;
  let n = 1;
  while (await isTaken(candidate)) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
