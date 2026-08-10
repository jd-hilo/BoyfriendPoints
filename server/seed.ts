import type { FeedEvent, User } from '../shared/types.ts';
import { id, type State } from './domain.ts';

interface DemoCouple {
  wife: string;
  boyfriend: string;
  color: string;
  bfColor: string;
  events: Array<{
    type: 'earn' | 'redeem';
    title: string;
    emoji: string;
    points: number;
    note: string;
    minutesAgo: number;
  }>;
}

const DEMO: DemoCouple[] = [
  {
    wife: 'Priya',
    boyfriend: 'Dev',
    color: '#7C5CFF',
    bfColor: '#00B8B8',
    events: [
      { type: 'earn', title: 'Mowed the lawn', emoji: '🌱', points: 50, note: 'Even did the edges 😤', minutesAgo: 42 },
      { type: 'redeem', title: 'Movie night, my pick', emoji: '🍿', points: 100, note: '', minutesAgo: 220 },
      { type: 'earn', title: 'Cooked dinner', emoji: '🍳', points: 60, note: 'Butter chicken from scratch', minutesAgo: 1500 },
    ],
  },
  {
    wife: 'Mia',
    boyfriend: 'Jake',
    color: '#E0498A',
    bfColor: '#F5A623',
    events: [
      { type: 'earn', title: 'Planned a date night', emoji: '🌹', points: 120, note: 'Rooftop tacos 🌮', minutesAgo: 90 },
      { type: 'earn', title: 'Took out the trash', emoji: '🗑️', points: 20, note: 'without being asked!!', minutesAgo: 640 },
      { type: 'redeem', title: 'Control the remote all weekend', emoji: '📺', points: 200, note: '', minutesAgo: 2600 },
    ],
  },
  {
    wife: 'Sofia',
    boyfriend: 'Leo',
    color: '#2EA84F',
    bfColor: '#FF6B6B',
    events: [
      { type: 'earn', title: 'Did the dishes', emoji: '🍽️', points: 30, note: 'and the pots 🙃', minutesAgo: 15 },
      { type: 'redeem', title: 'Girls night, no questions', emoji: '💃', points: 250, note: '', minutesAgo: 380 },
      { type: 'earn', title: 'Folded the laundry', emoji: '🧺', points: 40, note: '', minutesAgo: 4300 },
    ],
  },
];

/** Populate a fresh state with a demo community so the feed looks alive. */
export function seedDemo(state: State): void {
  const now = Date.now();
  for (const couple of DEMO) {
    const wife: User = {
      id: id('u_'),
      name: couple.wife,
      email: `${couple.wife.toLowerCase()}@demo.boyfriendpoints.app`,
      password: 'points',
      role: 'wife',
      color: couple.color,
      friendIds: [],
      points: 0,
      onboarded: true,
      demo: true,
      createdAt: new Date(now).toISOString(),
    };
    const boyfriend: User = {
      id: id('u_'),
      name: couple.boyfriend,
      email: `${couple.boyfriend.toLowerCase()}@demo.boyfriendpoints.app`,
      password: 'points',
      role: 'boyfriend',
      color: couple.bfColor,
      partnerId: wife.id,
      friendIds: [],
      points: 180,
      onboarded: true,
      demo: true,
      createdAt: new Date(now).toISOString(),
    };
    wife.partnerId = boyfriend.id;
    state.users.push(wife, boyfriend);

    for (const ev of couple.events) {
      const feed: FeedEvent = {
        id: id('f_'),
        type: ev.type,
        boyfriendId: boyfriend.id,
        wifeId: wife.id,
        title: ev.title,
        emoji: ev.emoji,
        points: ev.points,
        note: ev.note,
        likes: [],
        createdAt: new Date(now - ev.minutesAgo * 60_000).toISOString(),
      };
      state.feed.push(feed);
    }
  }

  // Cross-friend the demo wives so their feeds form one community.
  const demoWives = state.users.filter((u) => u.demo && u.role === 'wife');
  for (const a of demoWives) {
    for (const b of demoWives) {
      if (a.id !== b.id && !a.friendIds.includes(b.id)) a.friendIds.push(b.id);
    }
  }
}
