export type CategoryVisual = { icon: string; color: string };

export const CATEGORY_CONFIG: Record<string, CategoryVisual> = {
  Crypto: { icon: '₿', color: 'from-orange-500 to-yellow-500' },
  Bitcoin: { icon: '₿', color: 'from-orange-500 to-yellow-500' },
  Politics: { icon: '🏛️', color: 'from-blue-500 to-indigo-500' },
  'US Politics': { icon: '🇺🇸', color: 'from-blue-500 to-red-500' },
  Elections: { icon: '🗳️', color: 'from-purple-500 to-pink-500' },
  Sports: { icon: '⚽', color: 'from-green-500 to-emerald-500' },
  NBA: { icon: '🏀', color: 'from-orange-500 to-red-500' },
  NFL: { icon: '🏈', color: 'from-green-600 to-yellow-600' },
  Soccer: { icon: '⚽', color: 'from-green-500 to-emerald-500' },
  Pop: { icon: '🎬', color: 'from-pink-500 to-purple-500' },
  'Pop Culture': { icon: '🎬', color: 'from-pink-500 to-purple-500' },
  Entertainment: { icon: '🎭', color: 'from-pink-500 to-purple-500' },
  Science: { icon: '🔬', color: 'from-cyan-500 to-blue-500' },
  Tech: { icon: '💻', color: 'from-violet-500 to-purple-500' },
  AI: { icon: '🤖', color: 'from-violet-500 to-purple-500' },
  Economy: { icon: '📈', color: 'from-emerald-500 to-teal-500' },
  Finance: { icon: '💰', color: 'from-emerald-500 to-teal-500' },
  World: { icon: '🌍', color: 'from-blue-500 to-cyan-500' },
  Weather: { icon: '🌤️', color: 'from-sky-500 to-blue-500' },
  Climate: { icon: '🌡️', color: 'from-red-500 to-orange-500' },
  Announce: { icon: '📣', color: 'from-amber-500 to-orange-500' },
  Announcement: { icon: '📣', color: 'from-amber-500 to-orange-500' },
  Announcements: { icon: '📣', color: 'from-amber-500 to-orange-500' },
  News: { icon: '📰', color: 'from-slate-400 to-slate-600' },
  default: { icon: '📊', color: 'from-slate-500 to-slate-600' },
};

const CATEGORY_LOOKUP: Record<string, CategoryVisual> = Object.entries(CATEGORY_CONFIG)
  .reduce<Record<string, CategoryVisual>>((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});

const DEFAULT_CATEGORY = CATEGORY_CONFIG['default'];

export function getCategoryVisual(category?: string | null): CategoryVisual {
  if (!category) return DEFAULT_CATEGORY;
  const trimmed = category.trim();
  if (!trimmed) return DEFAULT_CATEGORY;

  const direct = CATEGORY_CONFIG[trimmed];
  if (direct) return direct;

  const normalized = trimmed.toLowerCase();
  const exact = CATEGORY_LOOKUP[normalized];
  if (exact) return exact;

  const partialKey = Object.keys(CATEGORY_LOOKUP).find((key) =>
    normalized.includes(key) || key.includes(normalized)
  );

  return partialKey ? CATEGORY_LOOKUP[partialKey] : DEFAULT_CATEGORY;
}
