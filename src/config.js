// Site-wide settings — edit these to change name / contact details everywhere.
export const SITE = {
  name: 'Dexter Smith',
  email: 'dexter.h.smith@outlook.com',
  instagram: 'dexo.photos',
  instagramUrl: 'https://www.instagram.com/dexo.photos/',
};

export const CATEGORIES = [
  { key: 'all', label: 'ALL' },
  { key: 'live-music', label: 'LIVE MUSIC' },
  { key: 'street', label: 'STREET' },
  { key: 'abstract', label: 'ABSTRACT' },
  { key: 'other', label: 'OTHER' },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
);
