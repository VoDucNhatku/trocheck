import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { maskPhones } from '../privacy';
import type { Comparison, Evidence, Label, Listing, ListingCard, ListingDetail, Location, Room } from './prototype-types';

// ARCHIVED PROTOTYPE ONLY: no production API read imports this module.
// Local extension samples stay git-ignored (see data/README.md).
// Override the location with RENER_LOCAL_SAMPLES=/path/to/file.json.
const DEFAULT_FILE = path.resolve(process.cwd(), '../../data/demo/extension-sample.json');

interface SampleFile {
  items: {
    post: {
      idempotency_key: string;
      source_group_id?: string;
      source_group_name?: string;
      permalink?: string;
      external_post_id?: string;
      posted_at?: string;
      text: string;
      text_complete: boolean;
    };
    // Hand-made labels: quotes that must appear verbatim in the (masked) text.
    labels: {
      room?: [string, Label][];
      room_fields?: Partial<Room>;
      loc?: [string, Label][];
      loc_fields?: Partial<Location>;
      rent_visibility?: 'not_stated' | 'ambiguous' | 'hidden_explicit';
    };
  }[];
}

export interface LocalSamples {
  cards: ListingCard[];
  details: Record<string, ListingDetail>;
  comparisons: Record<string, Comparison>;
}

const EMPTY: LocalSamples = { cards: [], details: {}, comparisons: {} };

/** Code point offsets of a verbatim quote; null if the quote is not in the text (it is then dropped). */
function locate(text: string, quote: string, label: Label): Evidence | null {
  const idx = text.indexOf(quote);
  if (idx < 0) return null;
  const start = Array.from(text.slice(0, idx)).length;
  return { start, end: start + Array.from(quote).length, quote, label, method: 'human' };
}

function toLabeled(text: string, quotes: [string, Label][] = []): Evidence[] {
  return quotes.map(([q, l]) => locate(text, q, l)).filter((e): e is Evidence => e !== null);
}

let cache: LocalSamples | undefined;

export function loadLocalSamples(): LocalSamples {
  if (cache) return cache;
  const file = process.env.RENER_LOCAL_SAMPLES ?? DEFAULT_FILE;
  let parsed: SampleFile;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as SampleFile;
  } catch {
    return (cache = EMPTY);
  }

  const out: LocalSamples = { cards: [], details: {}, comparisons: {} };
  parsed.items.forEach(({ post, labels }, i) => {
    const id = `x-${String(i + 1).padStart(2, '0')}`;
    const text = maskPhones(post.text);
    const roomEv = toLabeled(text, labels.room);
    const locEv = toLabeled(text, labels.loc);

    const listing: Listing = {
      listing_id: id,
      listing_index: 0,
      review_status: 'needs_review',
      rent: {
        visibility: labels.rent_visibility ?? 'not_stated',
        amount_form: 'none',
        amount_vnd: null,
        basis: 'unknown',
        period: 'unknown',
        includes: [],
        decision: 'abstained',
        abstain_reason: 'not_in_text',
      },
      area: { amount_form: 'none', value_m2: null, decision: 'abstained', abstain_reason: 'not_in_text' },
      room: {
        property_type: 'unknown',
        furnishing: 'unknown',
        ...labels.room_fields,
        decision: roomEv.length ? 'answered' : 'abstained',
        agreement: 'human',
        evidence: roomEv,
      },
      location: {
        resolution: 'unresolved',
        ...labels.loc_fields,
        decision: locEv.length ? 'answered' : 'abstained',
        agreement: 'human',
        evidence: locEv,
      },
      fees: [],
    };

    out.details[id] = {
      listing,
      post: {
        post_id: post.external_post_id ?? id,
        text,
        permalink: post.permalink ?? null,
        source_group_name: post.source_group_name ?? (post.source_group_id ? `Nhóm Facebook ${post.source_group_id}` : null),
        posted_at: post.posted_at ?? null,
        text_complete: post.text_complete,
      },
      sibling_count: 0,
      origin: 'extension',
    };

    // No exact price in any of these posts, so the API would refuse to compare them.
    out.comparisons[id] = {
      status: 'not_comparable',
      reason_codes: ['price_not_exact', 'ward_unresolved'],
      criteria: {
        ward_code: null,
        ward_name: null,
        property_type: listing.room.property_type,
        basis: 'unknown',
        area_band: null,
        window_days: 30,
        broad_group: false,
      },
      n: 0,
      median: null,
      p25: null,
      p75: null,
      n_per_m2: 0,
      median_per_m2: null,
      delta_percent: null,
      verdict: null,
      data_from: '2026-10-05',
      data_to: '2026-10-25',
      similar: [],
    };

    const loc = listing.location;
    out.cards.push({
      listing_id: id,
      property_type: listing.room.property_type,
      ward_name: loc.ward_name ?? null,
      landmark:
        [loc.street, loc.old_ward_name, loc.old_district_name].filter(Boolean).join(', ') || loc.landmark || null,
      rent: {
        visibility: listing.rent.visibility,
        amount_form: 'none',
        amount_vnd: null,
        basis: 'unknown',
        period: 'unknown',
      },
      area_m2: null,
      fees: [],
      posted_at: post.posted_at ?? null,
      verdict: null,
      delta_percent: null,
      origin: 'extension',
      text_complete: post.text_complete,
    });
  });
  return (cache = out);
}
