export interface Nation {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  color: string;
}

export const NATIONS_LIST: Nation[] = [
  { id: 'helsingkrona', name: 'Helsingkrona Nation', shortName: 'HK', aliases: ['hk', 'helsingkrona', 'helsingkrona nation'], color: '#E53E3E' },
  { id: 'goteborgs', name: 'Göteborgs Nation', shortName: 'GBG', aliases: ['gbg', 'goteborg', 'göteborg', 'goteborgs', 'göteborgs'], color: '#3B82F6' },
  { id: 'lunds', name: 'Lunds Nation', shortName: 'LU', aliases: ['ln', 'lu', 'lund', 'lunds'], color: '#22C55E' },
  { id: 'malmo', name: 'Malmö Nation', shortName: 'MN', aliases: ['mn', 'malmo', 'malmö', 'casa'], color: '#D97706' },
  { id: 'ostgota', name: 'Östgöta Nation', shortName: 'ÖG', aliases: ['og', 'ög', 'ostgota', 'östgöta', 'ostgota nation'], color: '#7C3AED' },
  { id: 'sydskanska', name: 'Sydskånska Nation', shortName: 'SS', aliases: ['ss', 'sydskanska', 'sydskånska', 'syd'], color: '#0284C7' },
  { id: 'vg', name: 'Västgöta Nation', shortName: 'VG', aliases: ['vg', 'vastgota', 'västgöta', 'vastgota nation'], color: '#DB2777' },
  { id: 'blekingska', name: 'Blekingska Nation', shortName: 'BL', aliases: ['bl', 'bn', 'blekinge', 'blekingska'], color: '#0D9488' },
  { id: 'kristianstad', name: 'Kristianstads Nation', shortName: 'KR', aliases: ['kr', 'kn', 'kristianstad', 'krischan', 'krischanstad'], color: '#EA580C' },
  { id: 'hallands', name: 'Hallands Nation', shortName: 'HL', aliases: ['hl', 'hn', 'halland', 'hallands'], color: '#2563EB' },
  { id: 'kalmar', name: 'Kalmar Nation', shortName: 'KA', aliases: ['ka', 'kn', 'kalmar'], color: '#B45309' },
  { id: 'wermlands', name: 'Wermlands Nation', shortName: 'WN', aliases: ['wn', 'wermlands', 'värmlands', 'varmlands', 'wermland'], color: '#1D4ED8' },
  { id: 'smalands', name: 'Smålands Nation', shortName: 'SM', aliases: ['sm', 'sn', 'smalands', 'smålands'], color: '#15803D' },
  { id: 'karneval', name: 'Lundakarnevalen', shortName: 'LK', aliases: ['lk', 'karneval', 'lundakarnevalen'], color: '#DC2626' },
  { id: 'afborgen', name: 'AF-borgen', shortName: 'AF', aliases: ['af', 'afb', 'af borgen', 'af-borgen', 'borgen', 'tbar', 't-bar', 'tibban'], color: '#C2410C' },
  { id: 'mejeriet', name: 'Mejeriet', shortName: 'MJ', aliases: ['mj', 'mejeri', 'mejeriet'], color: '#6D28D9' },
  { id: 'stadsparken', name: 'Stadsparken', shortName: 'SP', aliases: ['sp', 'stadsparken', 'stadspark'], color: '#16A34A' },
  // LTH:s kårsektioner (TLTH)
  { id: 'f-sektionen', name: 'F-sektionen', shortName: 'F', aliases: ['f', 'f-sektionen', 'teknisk fysik', 'teknisk matematik', 'teknisk nanovetenskap', 'fysik'], color: '#F59E0B' },
  { id: 'e-sektionen', name: 'E-sektionen', shortName: 'E', aliases: ['e', 'e-sektionen', 'elektroteknik', 'medicin och teknik'], color: '#059669' },
  { id: 'maskinsektionen', name: 'Maskinsektionen', shortName: 'M', aliases: ['m', 'maskin', 'maskinsektionen', 'maskinteknik'], color: '#EF4444' },
  { id: 'v-sektionen', name: 'V-sektionen', shortName: 'V', aliases: ['v', 'v-sektionen', 'väg- och vattenbyggnad', 'vag- och vattenbyggnad', 'lantmäteri', 'lantmateri', 'brandingenjör', 'brandingenjor', 'riskhantering'], color: '#0EA5E9' },
  { id: 'a-sektionen', name: 'A-sektionen', shortName: 'A', aliases: ['a', 'a-sektionen', 'arkitektur', 'industridesign'], color: '#EC4899' },
  { id: 'k-sektionen', name: 'K-sektionen', shortName: 'K', aliases: ['k', 'k-sektionen', 'kemiteknik', 'bioteknik', 'livsmedelsteknik'], color: '#14B8A6' },
  { id: 'd-sektionen', name: 'D-sektionen', shortName: 'D', aliases: ['d', 'd-sektionen', 'datateknik', 'informations- och kommunikationsteknik', 'ikt'], color: '#6366F1' },
  { id: 'dokt-sektionen', name: 'Dokt-sektionen', shortName: 'Dokt', aliases: ['dokt', 'dokt-sektionen', 'doktorander'], color: '#78716C' },
  { id: 'ingenjorssektionen', name: 'Ingenjörssektionen', shortName: 'Ing', aliases: ['ing', 'ingenjörssektionen', 'ingenjorssektionen', 'högskoleingenjör', 'hogskoleingenjor', 'basår', 'basar'], color: '#A855F7' },
  { id: 'w-sektionen', name: 'W-sektionen', shortName: 'W', aliases: ['w', 'w-sektionen', 'ekosystemteknik', 'risk säkerhet och krishantering'], color: '#84CC16' },
  { id: 'i-sektionen', name: 'I-sektionen', shortName: 'I', aliases: ['i', 'i-sektionen', 'industriell ekonomi'], color: '#F97316' },
  { id: 'other', name: 'Annat', shortName: '??', aliases: ['annat', 'annan', 'other', 'ovrigt', 'övrigt'], color: '#6B7280' },
];

// Keep all known organizers available for existing listings and search, while
// only exposing currently active choices when a user creates a listing.
export const SELECTABLE_NATIONS_LIST = NATIONS_LIST.filter(({ id }) => id !== 'karneval');

export function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getNationSearchText(nation: Nation) {
  return normalizeSearchText([nation.id, nation.name, nation.shortName, ...nation.aliases].join(' '));
}

export function nationMatchesQuery(nation: Nation, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  return !normalizedQuery || getNationSearchText(nation).includes(normalizedQuery);
}

export function getNation(id: string): Nation {
  return NATIONS_LIST.find(n => n.id === id) ?? {
    id,
    name: id,
    shortName: id.slice(0, 2).toUpperCase(),
    aliases: [],
    color: '#6B7280',
  };
}
