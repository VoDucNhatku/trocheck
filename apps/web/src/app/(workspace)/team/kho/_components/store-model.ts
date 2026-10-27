// The API filters first_seen_at (collection time), not posted_at.
export function storeQuery(query: string) {
  const params = new URLSearchParams(query);
  for (const [key, time] of [['date_from', '00:00:00.000'], ['date_to', '23:59:59.999']] as const) {
    const value = params.get(key);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value + 'T' + time + '+07:00');
      const calendar = new Date(value + 'T00:00:00.000Z');
      if (!Number.isNaN(date.getTime()) && calendar.toISOString().slice(0, 10) === value) params.set(key, date.toISOString());
    }
  }
  params.set('page_size', '20');
  return params.toString();
}
