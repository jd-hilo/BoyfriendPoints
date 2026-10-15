import type {
  EarnTask,
  FeedEvent,
  FeedEventView,
  NotificationItem,
  Prize,
  PublicUser,
  Redemption,
  Submission,
  Suggestion,
  User,
} from '../types';

const TASKS: Suggestion[] = [
  { title: 'Mowed the lawn', emoji: '🌱', points: 50 },
  { title: 'Did the dishes', emoji: '🍽️', points: 30 },
  { title: 'Cooked dinner', emoji: '🍳', points: 60 },
  { title: 'Took out the trash', emoji: '🗑️', points: 20 },
  { title: 'Planned a date night', emoji: '🌹', points: 120 },
  { title: 'Folded the laundry', emoji: '🧺', points: 40 },
];

export const PRIZE_SUGGESTIONS: Suggestion[] = [
  { title: 'Movie night, my pick', emoji: '🍿', points: 100 },
  { title: 'Breakfast in bed', emoji: '🥞', points: 150 },
  { title: 'Get out of one chore', emoji: '🧹', points: 120 },
  { title: 'Full-body massage', emoji: '💆‍♀️', points: 300 },
];

export const TASK_SUGGESTIONS = TASKS;

const NOW = Date.parse('2026-10-15T18:41:00.000Z');

function ago(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function avatarFor(seed: string): string {
  return `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(
    seed,
  )}&backgroundType=gradientLinear&radius=50`;
}

function stockPhoto(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/720/480`;
}

export interface ScreenshotState {
  users: User[];
  prizes: Prize[];
  tasks: EarnTask[];
  submissions: Submission[];
  redemptions: Redemption[];
  feed: FeedEvent[];
}

export function publicUser(state: ScreenshotState, user: User): PublicUser {
  const partner = user.partnerId
    ? state.users.find((candidate) => candidate.id === user.partnerId)
    : undefined;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    color: user.color,
    avatarUrl: user.avatarUrl,
    partnerId: user.partnerId,
    partnerName: partner?.name,
    partnerColor: partner?.color,
    partnerAvatar: partner?.avatarUrl,
    inviteCode: user.inviteCode,
    coupleCode: user.coupleCode,
    coupleUsername: user.coupleUsername,
    friendIds: user.friendIds,
    points: user.points,
    onboarded: user.onboarded,
    demo: user.demo,
  };
}

interface CoupleSeed {
  wifeId: string;
  bfId: string;
  wife: string;
  boyfriend: string;
  wifeColor: string;
  bfColor: string;
  bfPoints: number;
  demo: boolean;
  inviteCode: string;
  coupleCode: string;
  coupleUsername: string;
}

function makeCouple(seed: CoupleSeed): { wife: User; boyfriend: User } {
  const domain = seed.demo ? 'demo.boyfriendpoints.app' : 'boyfriendpoints.app';
  const wife: User = {
    id: seed.wifeId,
    name: seed.wife,
    email: `${seed.wife.toLowerCase()}@${domain}`,
    password: 'points',
    role: 'wife',
    color: seed.wifeColor,
    avatarUrl: avatarFor(seed.wife),
    inviteCode: seed.inviteCode,
    coupleCode: seed.coupleCode,
    coupleUsername: seed.coupleUsername,
    friendIds: [],
    points: 0,
    onboarded: true,
    demo: seed.demo,
    createdAt: ago(20_000),
  };
  const boyfriend: User = {
    id: seed.bfId,
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
    demo: seed.demo,
    createdAt: ago(20_000),
  };
  wife.partnerId = boyfriend.id;
  return { wife, boyfriend };
}

/** Emma + Noah household, community couples, and an unlinked onboarding persona. */
export function createScreenshotState(): ScreenshotState {
  const { wife: emma, boyfriend: noah } = makeCouple({
    wifeId: 'u_emma',
    bfId: 'u_noah',
    wife: 'Emma',
    boyfriend: 'Noah',
    wifeColor: '#2383e2',
    bfColor: '#7C5CFF',
    bfPoints: 240,
    demo: false,
    inviteCode: 'EMMA12',
    coupleCode: 'NOAH34',
    coupleUsername: 'emmanoah',
  });

  const community: CoupleSeed[] = [
    {
      wifeId: 'u_priya',
      bfId: 'u_dev',
      wife: 'Priya',
      boyfriend: 'Dev',
      wifeColor: '#7C5CFF',
      bfColor: '#00B8B8',
      bfPoints: 180,
      demo: true,
      inviteCode: 'PRIYDEM',
      coupleCode: 'DEVDEM',
      coupleUsername: 'priyadev',
    },
    {
      wifeId: 'u_mia',
      bfId: 'u_jake',
      wife: 'Mia',
      boyfriend: 'Jake',
      wifeColor: '#E0498A',
      bfColor: '#F5A623',
      bfPoints: 90,
      demo: true,
      inviteCode: 'MIADEM',
      coupleCode: 'JAKEDEM',
      coupleUsername: 'miajake',
    },
    {
      wifeId: 'u_sofia',
      bfId: 'u_leo',
      wife: 'Sofia',
      boyfriend: 'Leo',
      wifeColor: '#2EA84F',
      bfColor: '#FF6B6B',
      bfPoints: 30,
      demo: true,
      inviteCode: 'SOFIDEM',
      coupleCode: 'LEODEM',
      coupleUsername: 'sofialeo',
    },
  ];

  const couples = community.map(makeCouple);
  const wives = [emma, ...couples.map((c) => c.wife)];
  const users: User[] = [emma, noah, ...couples.flatMap((c) => [c.wife, c.boyfriend])];

  for (const a of wives) {
    for (const b of wives) {
      if (a.id !== b.id) a.friendIds.push(b.id);
    }
  }

  const avery: User = {
    id: 'u_avery',
    name: 'Avery',
    email: 'avery@boyfriendpoints.app',
    password: 'points',
    role: 'boyfriend',
    color: '#00B8B8',
    avatarUrl: avatarFor('Avery'),
    inviteCode: 'AVE123',
    friendIds: [],
    points: 0,
    onboarded: true,
    createdAt: ago(40),
  };
  users.push(avery);

  const prizeSpecs: Array<[string, string, string, number]> = [
    ['p1', '🍿', 'Movie night, my pick', 100],
    ['p2', '🥞', 'Breakfast in bed', 150],
    ['p3', '🧹', 'Get out of one chore', 120],
    ['p4', '💆‍♀️', 'Full-body massage', 300],
  ];
  const prizes: Prize[] = prizeSpecs.map(([id, emoji, title, cost]) => ({
    id,
    wifeId: emma.id,
    title,
    emoji,
    cost,
    createdAt: ago(8000),
  }));

  const tasks: EarnTask[] = TASKS.map((task, i) => ({
    id: `t${i + 1}`,
    wifeId: emma.id,
    title: task.title,
    emoji: task.emoji,
    points: task.points,
    createdAt: ago(8000),
  }));

  const feed: FeedEvent[] = [
    {
      id: 'f1',
      type: 'earn',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Cooked dinner',
      emoji: '🍳',
      points: 60,
      note: 'mushroom risotto 🍚',
      images: [stockPhoto('noah-risotto-1'), stockPhoto('noah-risotto-2')],
      likes: [emma.id, 'u_mia'],
      reactions: [
        { emoji: '🔥', userId: 'u_priya' },
        { emoji: '😍', userId: 'u_mia' },
        { emoji: '👏', userId: 'u_sofia' },
      ],
      comments: [
        {
          id: 'c1',
          userId: 'u_priya',
          name: 'Priya',
          avatarUrl: avatarFor('Priya'),
          text: 'ok husband of the year fr 😭',
          createdAt: ago(110),
        },
        {
          id: 'c2',
          userId: 'u_mia',
          name: 'Mia',
          avatarUrl: avatarFor('Mia'),
          text: 'need to send this to mine',
          createdAt: ago(95),
        },
      ],
      createdAt: ago(130),
    },
    {
      id: 'f2',
      type: 'earn',
      boyfriendId: 'u_leo',
      wifeId: 'u_sofia',
      title: 'Did the dishes',
      emoji: '🍽️',
      points: 30,
      note: 'and the pots 🙃',
      images: [stockPhoto('leo-dishes-1')],
      likes: [emma.id],
      reactions: [{ emoji: '💪', userId: noah.id }],
      comments: [],
      createdAt: ago(15),
    },
    {
      id: 'f3',
      type: 'earn',
      boyfriendId: 'u_jake',
      wifeId: 'u_mia',
      title: 'Planned a date night',
      emoji: '🌹',
      points: 120,
      note: 'Rooftop tacos 🌮',
      images: [
        stockPhoto('jake-date-1'),
        stockPhoto('jake-date-2'),
        stockPhoto('jake-date-3'),
      ],
      likes: [emma.id, noah.id, 'u_priya'],
      reactions: [
        { emoji: '🌮', userId: emma.id },
        { emoji: '😂', userId: 'u_dev' },
      ],
      comments: [
        {
          id: 'c3',
          userId: emma.id,
          name: 'Emma',
          avatarUrl: avatarFor('Emma'),
          text: 'the rooftop??? obsessed',
          createdAt: ago(70),
        },
      ],
      createdAt: ago(90),
    },
    {
      id: 'f4',
      type: 'earn',
      boyfriendId: 'u_dev',
      wifeId: 'u_priya',
      title: 'Mowed the lawn',
      emoji: '🌱',
      points: 50,
      note: 'Even did the edges 😤',
      images: [stockPhoto('dev-lawn-1'), stockPhoto('dev-lawn-2')],
      likes: [],
      reactions: [],
      comments: [],
      createdAt: ago(42),
    },
    {
      id: 'f5',
      type: 'redeem',
      boyfriendId: 'u_dev',
      wifeId: 'u_priya',
      title: 'Movie night, my pick',
      emoji: '🍿',
      points: 100,
      note: '',
      images: [],
      likes: [noah.id],
      reactions: [],
      comments: [],
      createdAt: ago(220),
    },
    {
      id: 'f6',
      type: 'earn',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Mowed the lawn',
      emoji: '🌱',
      points: 50,
      note: '',
      images: [stockPhoto('noah-lawn-1')],
      likes: [],
      reactions: [{ emoji: '💪', userId: 'u_jake' }],
      comments: [],
      createdAt: ago(1500),
    },
    {
      id: 'f7',
      type: 'redeem',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Movie night, my pick',
      emoji: '🍿',
      points: 100,
      note: '',
      images: [],
      likes: ['u_sofia'],
      reactions: [],
      comments: [],
      createdAt: ago(2900),
    },
    {
      id: 'f8',
      type: 'earn',
      boyfriendId: 'u_jake',
      wifeId: 'u_mia',
      title: 'Took out the trash',
      emoji: '🗑️',
      points: 20,
      note: 'without being asked!!',
      images: [],
      likes: [],
      reactions: [],
      comments: [],
      createdAt: ago(640),
    },
    {
      id: 'f9',
      type: 'redeem',
      boyfriendId: 'u_leo',
      wifeId: 'u_sofia',
      title: 'Girls night, no questions',
      emoji: '💃',
      points: 250,
      note: '',
      images: [],
      likes: [emma.id],
      reactions: [],
      comments: [],
      createdAt: ago(380),
    },
    {
      id: 'f10',
      type: 'earn',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Folded the laundry',
      emoji: '🧺',
      points: 40,
      note: 'matched all the socks',
      images: [],
      likes: [],
      reactions: [],
      comments: [],
      createdAt: ago(5200),
    },
  ];

  const submissions: Submission[] = [
    {
      id: 's_sink',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Fixed the leaky sink',
      emoji: '🔧',
      points: 80,
      requestedPoints: 80,
      note: 'took two trips to the hardware store 😅',
      images: [stockPhoto('noah-sink-1'), stockPhoto('noah-sink-2')],
      status: 'pending',
      revised: false,
      shared: true,
      createdAt: ago(35),
    },
    {
      id: 's_car',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Washed & vacuumed the car',
      emoji: '🚗',
      points: 45,
      requestedPoints: 45,
      note: '',
      images: [stockPhoto('noah-car-1')],
      status: 'pending',
      revised: false,
      shared: true,
      createdAt: ago(190),
    },
    {
      id: 's_dinner',
      boyfriendId: noah.id,
      wifeId: emma.id,
      title: 'Cooked dinner',
      emoji: '🍳',
      points: 60,
      requestedPoints: 60,
      note: 'mushroom risotto 🍚',
      images: [stockPhoto('noah-risotto-1')],
      status: 'approved',
      revised: false,
      shared: true,
      createdAt: ago(130),
      resolvedAt: ago(120),
    },
  ];

  const redemptions: Redemption[] = [
    {
      id: 'r_breakfast',
      boyfriendId: noah.id,
      wifeId: emma.id,
      prizeTitle: 'Breakfast in bed',
      emoji: '🥞',
      cost: 150,
      status: 'pending',
      shared: true,
      createdAt: ago(300),
    },
  ];

  return { users, prizes, tasks, submissions, redemptions, feed };
}

export function userByPersona(
  state: ScreenshotState,
  persona: string | null,
): User | null {
  if (!persona) return null;
  const match = state.users.find((u) => u.name.toLowerCase() === persona);
  return match ?? null;
}

export function feedViews(
  state: ScreenshotState,
  viewer: User,
): FeedEventView[] {
  const names = new Map(state.users.map((u) => [u.id, u]));
  return [...state.feed]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => {
      const boyfriend = names.get(e.boyfriendId);
      const wife = names.get(e.wifeId);
      return {
        ...e,
        boyfriendName: boyfriend?.name ?? 'Someone',
        boyfriendColor: boyfriend?.color ?? '#008CFF',
        boyfriendAvatar: boyfriend?.avatarUrl,
        wifeName: wife?.name ?? 'their partner',
        wifeColor: wife?.color ?? '#7C5CFF',
        wifeAvatar: wife?.avatarUrl,
        likedByMe: e.likes.includes(viewer.id),
      };
    });
}

export function notificationsFor(
  state: ScreenshotState,
  user: User,
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const display = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    return {
      name: u?.name ?? 'Someone',
      color: u?.color ?? '#008CFF',
      avatar: u?.avatarUrl,
    };
  };

  for (const s of state.submissions) {
    if (s.boyfriendId === user.id && s.status !== 'pending') {
      const wife = display(s.wifeId);
      items.push({
        id: `n_appr_${s.id}`,
        kind: s.status === 'approved' ? 'approved' : 'denied',
        emoji: s.status === 'approved' ? '✅' : '🙈',
        title:
          s.status === 'approved'
            ? `${wife.name} approved your request`
            : `${wife.name} passed on your request`,
        body: `${s.emoji} ${s.title}`,
        points: s.status === 'approved' ? s.points : undefined,
        actorName: wife.name,
        actorColor: wife.color,
        actorAvatar: wife.avatar,
        createdAt: s.resolvedAt ?? s.createdAt,
      });
    }
    if (s.wifeId === user.id && s.status === 'pending') {
      const bf = display(s.boyfriendId);
      items.push({
        id: `n_req_${s.id}`,
        kind: 'request',
        emoji: s.emoji,
        title: `${bf.name} requested points`,
        body: s.title,
        points: s.requestedPoints,
        actorName: bf.name,
        actorColor: bf.color,
        actorAvatar: bf.avatar,
        createdAt: s.createdAt,
      });
    }
  }

  for (const r of state.redemptions) {
    if (r.wifeId === user.id && r.status === 'pending') {
      const bf = display(r.boyfriendId);
      items.push({
        id: `n_redeem_${r.id}`,
        kind: 'redeem',
        emoji: r.emoji,
        title: `${bf.name} redeemed a prize`,
        body: r.prizeTitle,
        points: r.cost,
        actorName: bf.name,
        actorColor: bf.color,
        actorAvatar: bf.avatar,
        createdAt: r.createdAt,
      });
    }
  }

  for (const e of state.feed) {
    const mine = e.boyfriendId === user.id || e.wifeId === user.id;
    if (!mine) continue;
    const others = e.reactions.filter((r) => r.userId !== user.id);
    if (others.length > 0) {
      const first = display(others[0].userId);
      const extra = others.length - 1;
      items.push({
        id: `n_react_${e.id}`,
        kind: 'reaction',
        emoji: others[0].emoji,
        title:
          extra > 0
            ? `${first.name} & ${extra} other${extra > 1 ? 's' : ''} reacted`
            : `${first.name} reacted`,
        body: `${e.emoji} ${e.title}`,
        actorName: first.name,
        actorColor: first.color,
        actorAvatar: first.avatar,
        createdAt: e.createdAt,
      });
    }
    for (const c of e.comments) {
      if (c.userId === user.id) continue;
      items.push({
        id: `n_comment_${c.id}`,
        kind: 'comment',
        emoji: '💬',
        title: `${c.name} commented`,
        body: `“${c.text}”`,
        actorName: c.name,
        actorAvatar: c.avatarUrl,
        createdAt: c.createdAt,
      });
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
