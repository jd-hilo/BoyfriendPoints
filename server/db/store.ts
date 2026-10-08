import { eq, inArray, or, sql } from 'drizzle-orm';
import type {
  ContentReport,
  EarnTask,
  FeedEvent,
  FriendRequest,
  Prize,
  Redemption,
  ReportTarget,
  Role,
  Submission,
  SubmissionStatus,
  User,
  UserBlock,
} from '../../shared/types.ts';
import { createEmptyState, healPartnerLink, type State } from '../domain.ts';
import {
  blocks,
  feed,
  friendRequests,
  prizes,
  redemptions,
  reports,
  submissions,
  tasks,
  users,
} from './schema.ts';
import type { Database } from './client.ts';
import { seedDemo } from '../seed.ts';

export function asUser(row: typeof users.$inferSelect): User {
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
    pushToken: row.pushToken ?? undefined,
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
    pushToken: u.pushToken ?? null,
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
    forPartnerId: row.forPartnerId ?? undefined,
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
    forPartnerId: row.forPartnerId ?? undefined,
    createdAt: row.createdAt,
  };
}

function isPickedAvatar(url?: string): boolean {
  return Boolean(url && url.includes('/api/media/'));
}

function upsertUser(state: State, live: User): User {
  const idx = state.users.findIndex((user) => user.id === live.id);
  if (idx >= 0) {
    const current = state.users[idx];
    const partnerId = live.partnerId ?? current.partnerId;
    const onboarded = current.onboarded || live.onboarded;
    const avatarUrl =
      isPickedAvatar(current.avatarUrl) && !isPickedAvatar(live.avatarUrl)
        ? current.avatarUrl
        : (live.avatarUrl ?? current.avatarUrl);
    Object.assign(current, live);
    current.partnerId = partnerId;
    current.onboarded = onboarded;
    current.avatarUrl = avatarUrl;
    return current;
  }
  state.users.push(live);
  return live;
}

/** Write name/avatar immediately so a later full-state dump cannot
 *  replace a picked photo with the generated default. */
export async function persistUserProfile(
  db: Database,
  user: User,
): Promise<void> {
  await db
    .update(users)
    .set({
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      onboarded: user.onboarded,
    })
    .where(eq(users.id, user.id));
}

/** Write partner_id / household identity for a linked pair so a later
 *  full-state dump cannot drop the join. */
export async function persistPartnerPair(
  db: Database,
  left: User,
  right: User,
): Promise<void> {
  for (const user of [left, right]) {
    await db
      .update(users)
      .set({
        partnerId: user.partnerId ?? null,
        inviteCode: user.inviteCode ?? null,
        coupleCode: user.coupleCode ?? null,
        coupleUsername: user.coupleUsername ?? null,
        onboarded: user.onboarded,
      })
      .where(eq(users.id, user.id));
  }
}

/**
 * Railway keeps a long-lived in-memory snapshot. Direct DB writes (or another
 * process) can link a partner that this process has never seen. Pull that
 * household into memory so `/me` and persist() stay in sync with Neon.
 */
export async function hydrateHousehold(
  db: Database,
  state: State,
  userId: string,
): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return undefined;
  const user = upsertUser(state, asUser(row));

  const related = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.partnerId, userId),
        user.partnerId ? eq(users.id, user.partnerId) : sql`false`,
      ),
    );
  for (const relatedRow of related) {
    upsertUser(state, asUser(relatedRow));
  }

  if (healPartnerLink(state, user)) {
    const partner = user.partnerId
      ? state.users.find((candidate) => candidate.id === user.partnerId)
      : undefined;
    if (partner) {
      try {
        await persistPartnerPair(db, user, partner);
      } catch {
        /* next persist() still has the healed memory */
      }
    }
  }

  const ownerIds = [user.id, user.partnerId].filter(
    (id): id is string => Boolean(id),
  );
  if (ownerIds.length === 0) return user;

  const [prizeRows, taskRows] = await Promise.all([
    db.select().from(prizes).where(inArray(prizes.wifeId, ownerIds)),
    db.select().from(tasks).where(inArray(tasks.wifeId, ownerIds)),
  ]);
  for (const prize of prizeRows) {
    if (!state.prizes.some((item) => item.id === prize.id)) {
      state.prizes.push(asPrize(prize));
    }
  }
  for (const task of taskRows) {
    if (!state.tasks.some((item) => item.id === task.id)) {
      state.tasks.push(asTask(task));
    }
  }
  return user;
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
    granted: Boolean(row.granted),
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

function asBlock(row: typeof blocks.$inferSelect): UserBlock {
  return {
    id: row.id,
    blockerId: row.blockerId,
    blockedId: row.blockedId,
    createdAt: row.createdAt,
  };
}

function asReport(row: typeof reports.$inferSelect): ContentReport {
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetType: row.targetType as ReportTarget,
    targetId: row.targetId,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export async function loadState(db: Database): Promise<State> {
  const [
    userRows,
    prizeRows,
    taskRows,
    subRows,
    redRows,
    feedRows,
    requestRows,
    blockRows,
    reportRows,
  ] = await Promise.all([
      db.select().from(users),
      db.select().from(prizes),
      db.select().from(tasks),
      db.select().from(submissions),
      db.select().from(redemptions),
      db.select().from(feed),
      db.select().from(friendRequests),
      db.select().from(blocks),
      db.select().from(reports),
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
    blocks: blockRows.map(asBlock),
    reports: reportRows.map(asReport),
  };
}

export async function saveState(db: Database, state: State): Promise<void> {
  // Never DELETE the users table. Cloudflare isolates load a snapshot per
  // request; a wipe-and-rewrite races with other writes and can drop a brand
  // new account (reload then looks signed out / back on onboarding).
  await db.delete(reports);
  await db.delete(blocks);
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
          avatarUrl: sql`CASE
            WHEN excluded.avatar_url LIKE '%/api/media/%' THEN excluded.avatar_url
            WHEN users.avatar_url LIKE '%/api/media/%' THEN users.avatar_url
            ELSE excluded.avatar_url
          END`,
          // Never let a stale snapshot unlink a household (Paul/Syd).
          partnerId: sql`COALESCE(excluded.partner_id, users.partner_id)`,
          inviteCode: sql`excluded.invite_code`,
          coupleCode: sql`excluded.couple_code`,
          coupleUsername: sql`excluded.couple_username`,
          friendIds: sql`excluded.friend_ids`,
          points: sql`excluded.points`,
          // Never let a stale in-memory snapshot wipe a live session token
          // (Railway rolling deploys load/save overlapping processes).
          token: sql`CASE
            WHEN excluded.token = '' THEN NULL
            WHEN excluded.token IS NULL THEN users.token
            ELSE excluded.token
          END`,
          pushToken: sql`excluded.push_token`,
          onboarded: sql`users.onboarded OR excluded.onboarded`,
          demo: sql`excluded.demo`,
          createdAt: sql`excluded.created_at`,
        },
      });
  }
  if (state.prizes.length > 0) {
    await db.insert(prizes).values(
      state.prizes.map((prize) => ({
        ...prize,
        forPartnerId: prize.forPartnerId ?? null,
      })),
    );
  }
  if (state.tasks.length > 0) {
    await db.insert(tasks).values(
      state.tasks.map((task) => ({
        ...task,
        forPartnerId: task.forPartnerId ?? null,
      })),
    );
  }
  if (state.submissions.length > 0) {
    await db.insert(submissions).values(
      state.submissions.map((s) => ({
        ...s,
        granted: Boolean(s.granted),
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
  if ((state.blocks ?? []).length > 0) {
    await db.insert(blocks).values(state.blocks);
  }
  if ((state.reports ?? []).length > 0) {
    await db.insert(reports).values(state.reports);
  }
}

export async function clearPartnerLink(db: Database, userId: string): Promise<void> {
  await db.update(users).set({ partnerId: null }).where(eq(users.id, userId));
}

/** Hard-delete one account. Sessions, photos, and owned rows cascade. */
export async function deleteUserRecord(db: Database, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE sessions, media, reports, blocks, friend_requests, feed, redemptions, submissions, tasks, prizes, users CASCADE`,
  );
}
