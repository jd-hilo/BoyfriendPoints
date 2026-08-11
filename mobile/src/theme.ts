/** Notion-inspired palette: white surfaces, warm grays, quiet accents. */
export const colors = {
  blue: '#2383e2',
  blueName: '#2383e2',
  blueSoft: '#f1f0ef',
  bg: '#ffffff',
  card: '#ffffff',
  panel: '#f7f6f3',
  ink: '#191918',
  ink2: '#787774',
  inkMuted: '#9b9a97',
  border: '#e9e9e7',
  green: '#448361',
  red: '#eb5757',
  white: '#ffffff',
  black: '#191918',
};

export const radius = {
  card: 10,
  pill: 999,
};

/** Notion cards are defined by hairline borders, not shadows. */
export const shadow = {
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 3,
  elevation: 1,
};

export const gradients = {
  xp: ['#2383e2', '#2383e2', '#1b6ec2'] as const,
};
