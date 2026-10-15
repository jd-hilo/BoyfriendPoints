import { isScreenshotMode } from './mode';

export type ShotName =
  | 'feed'
  | 'submit'
  | 'redeem'
  | 'requests'
  | 'manage'
  | 'profile'
  | 'notifications'
  | 'onboarding'
  | 'link';

export type ScreenshotPersona = 'emma' | 'noah' | 'avery';

export interface ScreenshotRoute {
  shot: ShotName;
  persona: ScreenshotPersona | null;
}

const SHOTS = new Set<ShotName>([
  'feed',
  'submit',
  'redeem',
  'requests',
  'manage',
  'profile',
  'notifications',
  'onboarding',
  'link',
]);

const PERSONAS = new Set<ScreenshotPersona>(['emma', 'noah', 'avery']);

const DEFAULT_PERSONA: Record<ShotName, ScreenshotPersona | null> = {
  feed: 'noah',
  submit: 'noah',
  redeem: 'noah',
  requests: 'emma',
  manage: 'emma',
  profile: 'noah',
  notifications: 'emma',
  onboarding: null,
  link: 'avery',
};

function readSearch(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const fromSearch = window.location.search;
  if (fromSearch) return new URLSearchParams(fromSearch);
  const hash = window.location.hash.replace(/^#/, '');
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(q);
}

export function parseScreenshotRoute(): ScreenshotRoute {
  const params = readSearch();
  const rawShot = (params.get('shot') ?? 'feed').toLowerCase();
  const shot: ShotName = SHOTS.has(rawShot as ShotName)
    ? (rawShot as ShotName)
    : 'feed';
  const rawPersona = (params.get('persona') ?? '').toLowerCase();
  const persona: ScreenshotPersona | null = PERSONAS.has(
    rawPersona as ScreenshotPersona,
  )
    ? (rawPersona as ScreenshotPersona)
    : DEFAULT_PERSONA[shot];
  return { shot, persona };
}

export function screenshotRoute(): ScreenshotRoute | null {
  if (!isScreenshotMode()) return null;
  return parseScreenshotRoute();
}
