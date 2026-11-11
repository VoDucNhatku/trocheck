import 'server-only';

export type RoomImage = { src: string; alt: string };

/** Newest room photos from the store for the login strip; an empty list falls back to the bundled photo. */
export async function getRoomPhotos(): Promise<RoomImage[]> {
  const base = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/+$/, '');
  try {
    const response = await fetch(`${base}/images/recent?limit=12`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return [];
    const body: unknown = await response.json();
    const items = (body as { items?: unknown }).items;
    if (!Array.isArray(items)) return [];
    return items
      .map(item => (item as { url?: unknown }).url)
      .filter((url): url is string => typeof url === 'string' && url.startsWith('https://res.cloudinary.com/'))
      .map(src => ({ src, alt: 'Ảnh phòng từ một bài đăng trong kho TrọCheck' }));
  } catch {
    return [];
  }
}
