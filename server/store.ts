import { sql } from 'drizzle-orm';
import type {
  EarnTask,
  FeedEvent,
  Prize,
  Redemption,
  Role,
  Submission,
  SubmissionStatus,
  User,
} from '../shared/types.ts';
import { createEmptyState, type State } from './domain.ts';
import { db } from './db/client.ts';
import {
  feed,
  prizes,
  redemptions,
  submissions,
  tasks,
  users,
} from './db/schema.ts';
import { seedDemo } from './seed.ts';

function asUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role as Role,
    color: row.color,
    partnerId: row.partnerId ?? undefined,
    friendIds: row.friendIds ?? [],
    points: row.points,
    token: row.token ?? undefined,
    onboarded: row.onboarded,
    demo: row.demo,
    createdAt: row.createdAt,
  };
}

function asPrize(row: typeof prizes.$inferSelect): Prize {
  return {
    id: row.id,
    wifeId: row.wifeId,
    title: row.title,
    emoji: row.emoji,
    cost: row.cost,
    createdAt: row.createdAt,
  };
}

function asTask(row: typeof tasks.$inferSelect): EarnTask {
  return {
    id: row.id,
    wifeId: row.wifeId,
    title: row.title,
    emoji: row.emoji,
    points: row.points,
    createdAt: row.createdAt,
  };
}

function asSubmission(row: typeof submissions.$inferSelect): Submission {
  return {
    id: row.id,
    boyfriendId: row.boyfriendId,
    wifeId: row.wifeId,
    title: row.title,
    emoji: row.emoji,
    points: row.points,
    requestedPoints: row.requestedPoints,
    note: row.note,
    status: row.status as SubmissionStatus,
    revised: row.revised,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? undefined,
  };
}

function asRedemption(row: typeof redemptions.$inferSelect): Redemption {
  return {
    id: row.id,
    boyfriendId: row.boyfriendId,
    wifeId: row.wifeId,
    prizeTitle: row.prizeTitle,
    emoji: row.emoji,
    cost: row.cost,
    status: row.status as Redemption['status'],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? undefined,
  };
}

function asFeed(row: typeof feed.$inferSelect): FeedEvent {
  return {
    id: row.id,
    type: row.type as FeedEvent['type'],
    boyfriendId: row.boyfriendId,
    wifeId: row.wifeId,
    title: row.title,
    emoji: row.emoji,
    points: row.points,
    note: row.note,
    likes: row.likes ?? [],
    createdAt: row.createdAt,
  };
}

export async function loadState(): Promise<State> {
  const [userRows, prizeRows, taskRows, subRows, redRows, feedRows] =
    await Promise.all([
      db.select().from(users),
      db.select().from(prizes),
      db.select().from(tasks),
      db.select().from(submissions),
      db.select().from(redemptions),
      db.select().from(feed),
    ]);

  if (userRows.length === 0) {
    const state = createEmptyState();
    seedDemo(state);
    await saveState(state);
    return state;
  }

  return {
    users: userRows.map(asUser),
    prizes: prizeRows.map(asPrize),
    tasks: taskRows.map(asTask),
    submissions: subRows.map(asSubmission),
    redemptions: redRows.map(asRedemption),
    feed: feedRows.map(asFeed),
  };
}

/** Persist the in-memory state to Neon. Safe for this demo-scale app. */
export async function saveState(state: State): Promise<void> {
  // Clear in FK-safe order, then re-insert. Neon HTTP driver has no multi-statement
  // transactions, so we wipe dependents first.
  await db.delete(feed);
  await db.delete(redemptions);
  await db.delete(submissions);
  await db.delete(tasks);
  await db.delete(prizes);
  await db.delete(users);

  if (state.users.length > 0) {
    await db.insert(users).values(
      state.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        color: u.color,
        partnerId: u.partnerId ?? null,
        friendIds: u.friendIds,
        points: u.points,
        token: u.token ?? null,
        onboarded: u.onboarded,
        demo: !!u.demo,
        createdAt: u.createdAt,
      })),
    );
  }
  if (state.prizes.length > 0) {
    await db.insert(prizes).values(state.prizes);
  }
  if (state.tasks.length > 0) {
    await db.insert(tasks).values(state.tasks);
  }
  if (state.submissions.length > 0) {
    await db.insert(submissions).values(
      state.submissions.map((s) => ({
        ...s,
        resolvedAt: s.resolvedAt ?? null,
      })),
    );
  }
  if (state.redemptions.length > 0) {
    await db.insert(redemptions).values(
      state.redemptions.map((r) => ({
        ...r,
        resolvedAt: r.resolvedAt ?? null,
      })),
    );
  }
  if (state.feed.length > 0) {
    await db.insert(feed).values(state.feed);
  }
}

/** Wipe every table — used by `pnpm db:reset`. */
export async function resetDatabase(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE feed, redemptions, submissions, tasks, prizes, users CASCADE`);
}
