/** Fictional teams and rosters. All names and branding are original. */

export interface Ratings {
  speed: number;
  shooting: number; // mid-range
  three: number;
  finishing: number; // layups / close
  dunk: number;
  passing: number;
  handling: number;
  defense: number;
  steal: number;
  block: number;
  rebound: number;
  stamina: number;
}

export type HairStyle = 'short' | 'afro' | 'buzz' | 'braids' | 'bald' | 'mohawk' | 'bun' | 'curly';

export interface Look {
  skin: number;
  hair: HairStyle;
  hairColor: number;
  headband?: number;
  sleeve?: number;
  beard?: boolean;
  shoes: number;
}

export interface PlayerDef {
  name: string;
  number: number;
  pos: 'G' | 'W' | 'B';
  height: number; // feet
  ratings: Ratings;
  look: Look;
}

export interface TeamDef {
  id: string;
  city: string;
  name: string;
  abbr: string;
  primary: number;
  secondary: number;
  /** Jersey number / trim colour that contrasts with primary. */
  text: number;
  /** Paint colour for the key when this team is home. */
  paint: number;
  icon: 'wave' | 'flame' | 'wolf' | 'sun' | 'bolt' | 'pine';
  players: PlayerDef[];
}

const SKIN = [0x3b2219, 0x5a3825, 0x7a4b2e, 0x9c6644, 0xc68863, 0xe0ac86, 0xf1c9a5];

function r(
  speed: number, shooting: number, three: number, finishing: number, dunk: number, passing: number,
  handling: number, defense: number, steal: number, block: number, rebound: number, stamina: number,
): Ratings {
  return { speed, shooting, three, finishing, dunk, passing, handling, defense, steal, block, rebound, stamina };
}

export const TEAMS: TeamDef[] = [
  {
    id: 'tides', city: 'Harbor City', name: 'Tides', abbr: 'HCT',
    primary: 0x0f7c8c, secondary: 0x0a3d4a, text: 0xffffff, paint: 0x0d6e7c, icon: 'wave',
    players: [
      { name: 'Marcus Reyes', number: 3, pos: 'G', height: 6.25, ratings: r(88, 80, 86, 74, 45, 84, 88, 66, 78, 30, 40, 82), look: { skin: SKIN[3], hair: 'short', hairColor: 0x1b1210, shoes: 0xffffff, headband: 0xffffff } },
      { name: 'Theo Lindqvist', number: 11, pos: 'W', height: 6.6, ratings: r(76, 82, 80, 72, 60, 70, 70, 74, 66, 54, 62, 78), look: { skin: SKIN[6], hair: 'bun', hairColor: 0xc9a066, shoes: 0x0a3d4a, sleeve: 0xffffff } },
      { name: 'Dayo Okafor', number: 34, pos: 'B', height: 6.95, ratings: r(68, 62, 38, 86, 90, 58, 52, 82, 52, 88, 90, 76), look: { skin: SKIN[0], hair: 'buzz', hairColor: 0x0d0907, shoes: 0x0f7c8c, beard: true } },
    ],
  },
  {
    id: 'blaze', city: 'Ember Valley', name: 'Blaze', abbr: 'EVB',
    primary: 0xe2562b, secondary: 0x2b2b30, text: 0xffffff, paint: 0xb8431f, icon: 'flame',
    players: [
      { name: 'Jaylen Cross', number: 1, pos: 'G', height: 6.15, ratings: r(92, 76, 82, 80, 58, 78, 92, 62, 82, 28, 36, 80), look: { skin: SKIN[1], hair: 'braids', hairColor: 0x120c0a, shoes: 0xe2562b, headband: 0xe2562b } },
      { name: 'Rico Valdez', number: 8, pos: 'W', height: 6.55, ratings: r(80, 84, 84, 70, 52, 68, 74, 70, 70, 44, 54, 80), look: { skin: SKIN[4], hair: 'curly', hairColor: 0x2a1a12, shoes: 0xffffff } },
      { name: 'Andre Booker', number: 22, pos: 'B', height: 6.9, ratings: r(70, 66, 50, 84, 86, 62, 56, 78, 56, 82, 86, 74), look: { skin: SKIN[2], hair: 'afro', hairColor: 0x1a110c, shoes: 0x2b2b30, sleeve: 0x2b2b30 } },
    ],
  },
  {
    id: 'wolves', city: 'Northgate', name: 'Wolves', abbr: 'NGW',
    primary: 0x23356b, secondary: 0xb9c3d6, text: 0xffffff, paint: 0x1f2f5f, icon: 'wolf',
    players: [
      { name: 'Eli Brandt', number: 5, pos: 'G', height: 6.3, ratings: r(84, 84, 90, 68, 40, 86, 84, 64, 72, 26, 38, 84), look: { skin: SKIN[5], hair: 'short', hairColor: 0x5a3b22, shoes: 0xb9c3d6 } },
      { name: 'Kobi Mensah', number: 14, pos: 'W', height: 6.65, ratings: r(82, 74, 72, 80, 78, 66, 72, 84, 80, 62, 66, 82), look: { skin: SKIN[0], hair: 'mohawk', hairColor: 0x0d0907, shoes: 0x23356b, headband: 0xb9c3d6 } },
      { name: 'Viktor Hale', number: 40, pos: 'B', height: 7.0, ratings: r(62, 72, 62, 80, 72, 70, 50, 80, 48, 90, 92, 72), look: { skin: SKIN[6], hair: 'buzz', hairColor: 0xb08a5a, shoes: 0xffffff, beard: true } },
    ],
  },
  {
    id: 'mirage', city: 'Sunridge', name: 'Mirage', abbr: 'SRM',
    primary: 0x6b3fa0, secondary: 0xf2b84b, text: 0xffffff, paint: 0x5a338a, icon: 'sun',
    players: [
      { name: 'Nico Albright', number: 7, pos: 'G', height: 6.2, ratings: r(90, 78, 84, 76, 50, 88, 90, 60, 76, 24, 34, 86), look: { skin: SKIN[4], hair: 'curly', hairColor: 0x120c0a, shoes: 0xf2b84b } },
      { name: 'Sam Achebe', number: 23, pos: 'W', height: 6.7, ratings: r(84, 76, 74, 84, 88, 66, 74, 72, 70, 66, 64, 82), look: { skin: SKIN[1], hair: 'short', hairColor: 0x0d0907, shoes: 0xffffff, headband: 0xf2b84b, sleeve: 0xf2b84b } },
      { name: 'Luka Petrov', number: 31, pos: 'B', height: 6.95, ratings: r(64, 78, 76, 76, 60, 78, 58, 74, 50, 76, 84, 74), look: { skin: SKIN[6], hair: 'short', hairColor: 0x2b1d14, shoes: 0x6b3fa0, beard: true } },
    ],
  },
  {
    id: 'voltage', city: 'Metro', name: 'Voltage', abbr: 'MTV',
    primary: 0xf2c418, secondary: 0x16161a, text: 0x16161a, paint: 0x2a2a30, icon: 'bolt',
    players: [
      { name: 'Tre Holloway', number: 0, pos: 'G', height: 6.1, ratings: r(94, 74, 80, 82, 62, 80, 94, 58, 84, 22, 34, 78), look: { skin: SKIN[2], hair: 'braids', hairColor: 0x0d0907, shoes: 0xf2c418 } },
      { name: 'Max Kowalski', number: 9, pos: 'W', height: 6.6, ratings: r(74, 86, 88, 66, 44, 72, 70, 68, 62, 46, 56, 78), look: { skin: SKIN[5], hair: 'bald', hairColor: 0x000000, shoes: 0x16161a, beard: true } },
      { name: 'Isaiah Grant', number: 50, pos: 'B', height: 7.05, ratings: r(66, 60, 30, 88, 94, 54, 50, 84, 54, 92, 90, 76), look: { skin: SKIN[1], hair: 'buzz', hairColor: 0x0d0907, shoes: 0xf2c418, sleeve: 0x16161a } },
    ],
  },
  {
    id: 'timber', city: 'Pinecrest', name: 'Timber', abbr: 'PCT',
    primary: 0x1f6b3a, secondary: 0xefe3c2, text: 0xefe3c2, paint: 0x1a5c31, icon: 'pine',
    players: [
      { name: 'Owen Park', number: 4, pos: 'G', height: 6.2, ratings: r(86, 82, 88, 70, 42, 86, 86, 66, 74, 26, 38, 86), look: { skin: SKIN[5], hair: 'short', hairColor: 0x0d0907, shoes: 0xefe3c2 } },
      { name: 'Malik Duarte', number: 15, pos: 'W', height: 6.7, ratings: r(82, 78, 76, 82, 82, 70, 76, 76, 72, 60, 66, 80), look: { skin: SKIN[3], hair: 'afro', hairColor: 0x150e0a, shoes: 0x1f6b3a, headband: 0xefe3c2 } },
      { name: 'Bo Jensen', number: 44, pos: 'B', height: 6.95, ratings: r(66, 70, 58, 84, 80, 64, 54, 82, 52, 86, 88, 78), look: { skin: SKIN[6], hair: 'curly', hairColor: 0x8a5a2b, shoes: 0xffffff, beard: true } },
    ],
  },
];

export function teamOverall(t: TeamDef): number {
  const avg = (p: PlayerDef) => {
    const v = p.ratings;
    return (v.speed + v.shooting + v.three + v.finishing + v.passing + v.handling + v.defense + v.rebound) / 8;
  };
  return Math.round(t.players.reduce((s, p) => s + avg(p), 0) / t.players.length);
}

export function playerOverall(p: PlayerDef): number {
  const v = p.ratings;
  const off = Math.max(v.shooting, v.three, v.finishing);
  return Math.round((off * 2 + v.speed + v.passing + v.handling + v.defense + v.rebound + v.dunk * 0.5 + v.steal * 0.5) / 8);
}
