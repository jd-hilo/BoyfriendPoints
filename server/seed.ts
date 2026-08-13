import type {
  EarnTask,
  FeedEvent,
  Prize,
  Redemption,
  Submission,
  User,
} from '../shared/types.ts';
import { avatarFor, id, stockPhoto, TASK_SUGGESTIONS, type State } from './domain.ts';

const now = () => Date.now();
const ago = (minutes: number) => new Date(now() - minutes * 60_000).toISOString();

interface CoupleSeed {
  wife: string;
  boyfriend: string;
  wifeColor: string;
  bfColor: string;
  bfPoints: number;
  events: Array<{
    type: 'earn' | 'redeem';
    title: string;
    emoji: string;
    points: number;
    note: string;
    minutesAgo: number;
    photos?: string[];
  }>;
}

const COMMUNITY: CoupleSeed[] = [
  {
    wife: 'Priya',
    boyfriend: 'Dev',
    wifeColor: '#7C5CFF',
    bfColor: '#00B8B8',
    bfPoints: 180,
    events: [
      { type: 'earn', title: 'Mowed the lawn', emoji: '🌱', points: 50, note: 'Even did the edges 😤', minutesAgo: 42, photos: ['dev-lawn-1', 'dev-lawn-2'] },
      { type: 'redeem', title: 'Movie night, my pick', emoji: '🍿', points: 100, note: '', minutesAgo: 220 },
      { type: 'earn', title: 'Cooked dinner', emoji: '🍳', points: 60, note: 'Butter chicken from scratch', minutesAgo: 1500, photos: ['dev-dinner-1'] },
    ],
  },
  {
    wife: 'Mia',
    boyfriend: 'Jake',
    wifeColor: '#E0498A',
    bfColor: '#F5A623',
    bfPoints: 90,
    events: [
      { type: 'earn', title: 'Planned a date night', emoji: '🌹', points: 120, note: 'Rooftop tacos 🌮', minutesAgo: 90, photos: ['jake-date-1', 'jake-date-2', 'jake-date-3'] },
      { type: 'earn', title: 'Took out the trash', emoji: '🗑️', points: 20, note: 'without being asked!!', minutesAgo: 640 },
      { type: 'redeem', title: 'Control the remote all weekend', emoji: '📺', points: 200, note: '', minutesAgo: 2600 },
    ],
  },
  {
    wife: 'Sofia',
    boyfriend: 'Leo',
    wifeColor: '#2EA84F',
    bfColor: '#FF6B6B',
    bfPoints: 30,
    events: [
      { type: 'earn', title: 'Did the dishes', emoji: '🍽️', points: 30, note: 'and the pots 🙃', minutesAgo: 15, photos: ['leo-dishes-1'] },
      { type: 'redeem', title: 'Girls night, no questions', emoji: '💃', points: 250, note: '', minutesAgo: 380 },
      { type: 'earn', title: 'Folded the laundry', emoji: '🧺', points: 40, note: '', minutesAgo: 4300 },
    ],
  },
];

function makeCouple(
  seed: CoupleSeed,
  demo: boolean,
): { wife: User; boyfriend: User } {
  const domain = demo ? 'demo.boyfriendpoints.app' : 'boyfriendpoints.app';
  const wife: User = {
    id: id('u_'),
    name: seed.wife,
    email: `${seed.wife.toLowerCase()}@${domain}`,
    password: 'points',
    role: 'wife',
    color: seed.wifeColor,
    avatarUrl: avatarFor(seed.wife),
    inviteCode: seed.wife.slice(0, 3).toUpperCase() + (demo ? 'DEM' : 'HOM'),
    coupleCode: seed.boyfriend.slice(0, 3).toUpperCase() + (demo ? 'DEM' : 'HOM'),
    coupleUsername: `${seed.wife}${seed.boyfriend}`.toLowerCase(),
    friendIds: [],
    points: 0,
    onboarded: true,
    demo,
    createdAt: new Date(now()).toISOString(),
  };
  const boyfriend: User = {
    id: id('u_'),
    name: seed.boyfriend,
    email: `${seed.boyfriend.toLowerCase()}@${domain}`,
    password: 'points',
    role: 'boyfriend',
    color: seed.bfColor,
    avatarUrl: avatarFor(seed.boyfriend),
    partnerId: wife.id,
    friendIds: [],
    points: seed.bfPoints,
    onboarded: true,
    demo,
    createdAt: new Date(now()).toISOString(),
  };
  wife.partnerId = boyfriend.id;
  return { wife, boyfriend };
}

function pushEvents(state: State, wife: User, boyfriend: User, seed: CoupleSeed) {
  for (const ev of seed.events) {
    const feed: FeedEvent = {
      id: id('f_'),
      type: ev.type,
      boyfriendId: boyfriend.id,
      wifeId: wife.id,
      title: ev.title,
      emoji: ev.emoji,
      points: ev.points,
      note: ev.note,
      images: (ev.photos ?? []).map(stockPhoto),
      likes: [],
      reactions: [],
      comments: [],
      createdAt: ago(ev.minutesAgo),
    };
    state.feed.push(feed);
  }
}

/** Populate a fresh state with a primary household + a demo community. */
export function seedDemo(state: State): void {
  // --- Primary household: Emma + Noah (this is "you" in the demo) ---------
  const { wife: emma, boyfriend: noah } = makeCouple(
    {
      wife: 'Emma',
      boyfriend: 'Noah',
      wifeColor: '#008CFF',
      bfColor: '#7C5CFF',
      bfPoints: 240,
      events: [
        { type: 'earn', title: 'Cooked dinner', emoji: '🍳', points: 60, note: 'mushroom risotto 🍚', minutesAgo: 130 },
        { type: 'earn', title: 'Mowed the lawn', emoji: '🌱', points: 50, note: '', minutesAgo: 1500 },
        { type: 'redeem', title: 'Movie night, my pick', emoji: '🍿', points: 100, note: '', minutesAgo: 2900 },
        { type: 'earn', title: 'Folded the laundry', emoji: '🧺', points: 40, note: 'matched all the socks', minutesAgo: 5200 },
      ],
    },
    false,
  );
  state.users.push(emma, noah);

  const emmaPrizes: Array<[string, string, number]> = [
    ['🍿', 'Movie night, my pick', 100],
    ['🥞', 'Breakfast in bed', 150],
    ['🧹', 'Get out of one chore', 120],
    ['💆‍♀️', 'Full-body massage', 300],
  ];
  for (const [emoji, title, cost] of emmaPrizes) {
    const prize: Prize = {
      id: id('p_'),
      wifeId: emma.id,
      title,
      emoji,
      cost,
      createdAt: new Date(now()).toISOString(),
    };
    state.prizes.push(prize);
  }

  for (const suggestion of TASK_SUGGESTIONS) {
    const task: EarnTask = {
      id: id('t_'),
      wifeId: emma.id,
      title: suggestion.title,
      emoji: suggestion.emoji,
      points: suggestion.points,
      createdAt: new Date(now()).toISOString(),
    };
    state.tasks.push(task);
  }

  pushEvents(state, emma, noah, {
    wife: 'Emma',
    boyfriend: 'Noah',
    wifeColor: '',
    bfColor: '',
    bfPoints: 0,
    events: [
      { type: 'earn', title: 'Cooked dinner', emoji: '🍳', points: 60, note: 'mushroom risotto 🍚', minutesAgo: 130, photos: ['noah-risotto-1', 'noah-risotto-2'] },
      { type: 'earn', title: 'Mowed the lawn', emoji: '🌱', points: 50, note: '', minutesAgo: 1500, photos: ['noah-lawn-1'] },
      { type: 'redeem', title: 'Movie night, my pick', emoji: '🍿', points: 100, note: '', minutesAgo: 2900 },
      { type: 'earn', title: 'Folded the laundry', emoji: '🧺', points: 40, note: 'matched all the socks', minutesAgo: 5200 },
    ],
  });

  // Pending point requests waiting for Emma to approve.
  const pending: Array<{
    emoji: string;
    title: string;
    points: number;
    note: string;
    minutesAgo: number;
    photos: string[];
  }> = [
    {
      emoji: '🔧',
      title: 'Fixed the leaky sink',
      points: 80,
      note: 'took two trips to the hardware store 😅',
      minutesAgo: 35,
      photos: ['noah-sink-1', 'noah-sink-2'],
    },
    {
      emoji: '🚗',
      title: 'Washed & vacuumed the car',
      points: 45,
      note: '',
      minutesAgo: 190,
      photos: ['noah-car-1'],
    },
  ];
  for (const p of pending) {
    const submission: Submission = {
      id: id('s_'),
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: p.title,
      emoji: p.emoji,
      points: p.points,
      requestedPoints: p.points,
      note: p.note,
      images: p.photos.map(stockPhoto),
      status: 'pending',
      revised: false,
      shared: true,
      createdAt: ago(p.minutesAgo),
    };
    state.submissions.push(submission);
  }

  // A redemption Emma still needs to fulfill (shows as an alert).
  const redemption: Redemption = {
    id: id('r_'),
    boyfriendId: noah.id,
    wifeId: emma.id,
    prizeTitle: 'Breakfast in bed',
    emoji: '🥞',
    cost: 150,
    status: 'pending',
    shared: true,
    createdAt: ago(300),
  };
  state.redemptions.push(redemption);

  // --- Community couples (fill the social feed) ---------------------------
  const wives: User[] = [emma];
  for (const seed of COMMUNITY) {
    const { wife, boyfriend } = makeCouple(seed, true);
    state.users.push(wife, boyfriend);
    pushEvents(state, wife, boyfriend, seed);
    wives.push(wife);
  }

  // Everyone follows everyone so the feed is one shared community.
  for (const a of wives) {
    for (const b of wives) {
      if (a.id !== b.id && !a.friendIds.includes(b.id)) a.friendIds.push(b.id);
    }
  }

  // Sprinkle some reactions + comments so the feed feels alive.
  const reactorIds = state.users.map((u) => u.id);
  const react = (i: number, emoji: string, who: number) => {
    const ev = state.feed[i];
    if (ev && reactorIds[who]) {
      ev.reactions.push({ emoji, userId: reactorIds[who] });
    }
  };
  const comment = (i: number, who: number, text: string) => {
    const ev = state.feed[i];
    const u = state.users[who];
    if (ev && u) {
      ev.comments.push({
        id: id('c_'),
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        text,
        createdAt: ago(10),
      });
    }
  };
  react(0, '🔥', 2);
  react(0, '😍', 4);
  react(0, '👏', 6);
  react(1, '💪', 3);
  react(4, '🌮', 0);
  react(4, '😂', 5);
  comment(0, 2, 'ok husband of the year fr 😭');
  comment(0, 4, 'need to send this to mine');
  comment(4, 0, 'the rooftop??? obsessed');
}
