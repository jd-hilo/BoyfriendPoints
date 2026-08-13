import { sql } from 'drizzle-orm';
import type {
  EarnTask,
  FeedEvent,
  FriendRequest,
  Prize,
  Redemption,
  Role,
  Submission,
  SubmissionStatus,
  User,
} from '../../shared/types.ts';
import { createEmptyState, type State } from '../domain.ts';
import {
  feed,
  friendRequests,
  prizes,
  redemptions,
  submissions,
  tasks,
  users,
} from './schema.ts';
import type { Database } from './client.ts';
import { seedDemo } from '../seed.ts';

function asUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role as Role,
    color: row.color,
    avatarUrl: row.avatarUrl ?? undefined,
    partnerId: row.partnerId ?? undefined,
    inviteCode: row.inviteCode ?? undefined,
    coupleCode: row.coupleCode ?? undefined,
    coupleUsername: row.coupleUsername ?? undefined,
    friendIds: row.friendIds ?? [],
    points: row.points,
    token: row.token ?? undefined,
    onboarded: Boolean(row.onboarded),
    demo: row.demo,
    createdAt: row.createdAt,
  };
}

function userValues(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role,
    color: u.color,
    avatarUrl: u.avatarUrl ?? null,
    partnerId: u.partnerId ?? null,
    inviteCode: u.inviteCode ?? null,
    coupleCode: u.coupleCode ?? null,
    coupleUsername: u.coupleUsername ?? null,
    friendIds: u.friendIds,
    points: u.points,
    token: u.token ?? null,
    onboarded: u.onboarded,
    demo: !!u.demo,
    createdAt: u.createdAt,
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
    images: row.images ?? [],
    status: row.status as SubmissionStatus,
    revised: row.revised,
    shared: row.shared,
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
    shared: row.shared,
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
    images: row.images ?? [],
    likes: row.likes ?? [],
    reactions: row.reactions ?? [],
    comments: row.comments ?? [],
    createdAt: row.createdAt,
  };
}

function asFriendRequest(
  row: typeof friendRequests.$inferSelect,
): FriendRequest {
  return {
    id: row.id,
    fromWifeId: row.fromWifeId,
    toWifeId: row.toWifeId,
    status: row.status as FriendRequest['status'],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? undefined,
  };
}

export async function loadState(db: Database): Promise<State> {
  const [userRows, prizeRows, taskRows, subRows, redRows, feedRows, requestRows] =
    await Promise.all([
      db.select().from(users),
      db.select().from(prizes),
      db.select().from(tasks),
      db.select().from(submissions),
      db.select().from(redemptions),
      db.select().from(feed),
      db.select().from(friendRequests),
    ]);

  if (userRows.length === 0) {
    const state = createEmptyState();
    seedDemo(state);
    await saveState(db, state);
    return state;
  }

  return {
    users: userRows.map(asUser),
    prizes: prizeRows.map(asPrize),
    tasks: taskRows.map(asTask),
    submissions: subRows.map(asSubmission),
    redemptions: redRows.map(asRedemption),
    feed: feedRows.map(asFeed),
    friendRequests: requestRows.map(asFriendRequest),
  };
}

export async function saveState(db: Database, state: State): Promise<void> {
  // Never DELETE the users table. Cloudflare isolates load a snapshot per
  // request; a wipe-and-rewrite races with other writes and can drop a brand
  // new account (reload then looks signed out / back on onboarding).
  await db.delete(friendRequests);
  await db.delete(feed);
  await db.delete(redemptions);
  await db.delete(submissions);
  await db.delete(tasks);
  await db.delete(prizes);

  if (state.users.length > 0) {
    await db
      .insert(users)
      .values(state.users.map(userValues))
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          password: sql`excluded.password`,
          role: sql`excluded.role`,
          color: sql`excluded.color`,
          avatarUrl: sql`excluded.avatar_url`,
          partnerId: sql`excluded.partner_id`,
          inviteCode: sql`excluded.invite_code`,
          coupleCode: sql`excluded.couple_code`,
          coupleUsername: sql`excluded.couple_username`,
          friendIds: sql`excluded.friend_ids`,
          points: sql`excluded.points`,
          token: sql`excluded.token`,
          onboarded: sql`users.onboarded OR excluded.onboarded`,
          demo: sql`excluded.demo`,
          createdAt: sql`excluded.created_at`,
        },
      });
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
  if (state.friendRequests.length > 0) {
    await db.insert(friendRequests).values(
      state.friendRequests.map((request) => ({
        ...request,
        resolvedAt: request.resolvedAt ?? null,
      })),
    );
  }
}

export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE friend_requests, feed, redemptions, submissions, tasks, prizes, users CASCADE`,
  );
}
