import type { components } from './generated';

/** All unfiltered pages, never the filtered page or market summary. Caller scopes the dataset. */
export async function collectCatalog(load: (page: number) => Promise<components['schemas']['ListingsResponse']>) {
  const wards = new Set<string>();
  // Old districts present in the shared store (key -> label such as "Thủ Đức (cũ)").
  const districts = new Map<string, { label: string; count: number }>();
  const first = await load(1);
  let result = first;
  while (true) {
    for (const item of result.items) {
      if (item.ward_name) wards.add(item.ward_name);
      if (item.old_district_key && item.old_district) {
        const seen = districts.get(item.old_district_key);
        districts.set(item.old_district_key, { label: item.old_district, count: (seen?.count ?? 0) + 1 });
      }
    }
    if (result.page * result.page_size >= result.total || result.items.length === 0) break;
    result = await load(result.page + 1);
  }
  return {
    wards: [...wards].sort((a, b) => a.localeCompare(b, 'vi')),
    districts: [...districts].map(([key, d]) => ({ key, label: d.label, count: d.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi')),
    total: first.total, is_demo: first.is_demo,
  };
}
