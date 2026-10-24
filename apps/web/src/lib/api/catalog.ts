import type { components } from './generated';

/** All unfiltered pages, never the filtered page or market summary. Caller scopes the dataset. */
export async function collectCatalog(load: (page: number) => Promise<components['schemas']['ListingsResponse']>) {
  const wards = new Set<string>();
  const first = await load(1);
  let result = first;
  while (true) {
    for (const item of result.items) if (item.ward_name) wards.add(item.ward_name);
    if (result.page * result.page_size >= result.total || result.items.length === 0) break;
    result = await load(result.page + 1);
  }
  return { wards: [...wards].sort((a, b) => a.localeCompare(b, 'vi')), total: first.total, is_demo: first.is_demo };
}
