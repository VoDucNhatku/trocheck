export function filterQuery(query: Record<string, string | string[] | undefined>, keys: string[]): string {
  const result = new URLSearchParams();
  for (const key of keys) {
    const value = query[key];
    if (typeof value === 'string' && value) result.set(key, key === 'page' ? String(Math.max(1, Math.floor(Number(value) || 1))) : value);
  }
  return result.toString();
}
