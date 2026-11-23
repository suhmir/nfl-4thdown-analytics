import { hex, lighten } from '../core/math';
import type { TeamDef } from '../data/teams';

/** Original SVG team badges built from simple shapes. */
const ICONS: Record<TeamDef['icon'], (fg: string) => string> = {
  wave: (fg) => `<path d="M18 60c8-14 20-20 32-14 7 3 10 10 18 10 6 0 10-4 14-9-2 16-14 25-27 22-9-2-12-9-20-9-7 0-12 4-17 0z" fill="${fg}"/><path d="M22 70c10 6 20 6 29 2s20-4 28 1" stroke="${fg}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  flame: (fg) => `<path d="M50 18c4 14 20 20 20 40a20 20 0 0 1-40 0c0-9 5-15 9-19 0 8 3 12 7 13-3-13 0-24 4-34z" fill="${fg}"/><path d="M50 50c2 6 9 8 9 16a9 9 0 0 1-18 0c0-6 5-8 9-16z" fill="rgba(0,0,0,.25)"/>`,
  wolf: (fg) => `<path d="M24 30l14 10h24l14-10-4 22 6 8-14 6-14 16-14-16-14-6 6-8z" fill="${fg}"/><circle cx="42" cy="54" r="3.2" fill="rgba(0,0,0,.55)"/><circle cx="58" cy="54" r="3.2" fill="rgba(0,0,0,.55)"/>`,
  sun: (fg) => `<circle cx="50" cy="50" r="15" fill="${fg}"/>${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; const x1 = 50 + Math.cos(a) * 21; const y1 = 50 + Math.sin(a) * 21; const x2 = 50 + Math.cos(a) * 31; const y2 = 50 + Math.sin(a) * 31; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fg}" stroke-width="5" stroke-linecap="round"/>`; }).join('')}`,
  bolt: (fg) => `<path d="M56 16L30 54h16l-6 30 28-40H52z" fill="${fg}"/>`,
  pine: (fg) => `<path d="M50 16l18 24h-9l14 18h-10l13 16H24l13-16H27l14-18h-9z" fill="${fg}"/><rect x="46" y="74" width="8" height="10" fill="${fg}"/>`,
};

export function teamLogo(t: TeamDef, size = 64): string {
  const bg = hex(t.primary);
  const ring = hex(t.secondary);
  const fg = t.text === t.primary ? '#ffffff' : hex(t.text);
  const id = `g_${t.id}_${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${t.city} ${t.name} logo">
    <defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${hex(lighten(t.primary, 0.25))}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="${ring}"/>
    <circle cx="50" cy="50" r="41" fill="url(#${id})"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    ${ICONS[t.icon](fg)}
  </svg>`;
}

export const BALL_ICON = `<svg viewBox="0 0 100 100" class="ball-icon" aria-hidden="true">
  <circle cx="50" cy="50" r="46" fill="#e8742c" stroke="#2a140a" stroke-width="5"/>
  <path d="M4 50h92M50 4v92M18 18c14 14 14 50 0 64M82 18c-14 14-14 50 0 64" stroke="#2a140a" stroke-width="4" fill="none"/>
  <ellipse cx="34" cy="30" rx="12" ry="7" fill="rgba(255,255,255,.3)"/>
</svg>`;
