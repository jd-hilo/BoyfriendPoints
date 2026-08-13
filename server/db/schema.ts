import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull(), // 'wife' | 'boyfriend'
  color: text('color').notNull(),
  avatarUrl: text('avatar_url'),
  partnerId: text('partner_id'),
  inviteCode: text('invite_code'),
  coupleCode: text('couple_code'),
  coupleUsername: text('couple_username').unique(),
  friendIds: jsonb('friend_ids').$type<string[]>().notNull().default([]),
  points: integer('points').notNull().default(0),
  token: text('token'),
  onboarded: boolean('onboarded').notNull().default(false),
  demo: boolean('demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const prizes = pgTable('prizes', {
  id: text('id').primaryKey(),
  wifeId: text('wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  emoji: text('emoji').notNull(),
  cost: integer('cost').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const friendRequests = pgTable('friend_requests', {
  id: text('id').primaryKey(),
  fromWifeId: text('from_wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  toWifeId: text('to_wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // pending | accepted | declined
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  wifeId: text('wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  emoji: text('emoji').notNull(),
  points: integer('points').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const submissions = pgTable('submissions', {
  id: text('id').primaryKey(),
  boyfriendId: text('boyfriend_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  wifeId: text('wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  emoji: text('emoji').notNull(),
  points: integer('points').notNull(),
  requestedPoints: integer('requested_points').notNull(),
  note: text('note').notNull().default(''),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  status: text('status').notNull(), // pending | approved | denied
  revised: boolean('revised').notNull().default(false),
  shared: boolean('shared').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
});

export const redemptions = pgTable('redemptions', {
  id: text('id').primaryKey(),
  boyfriendId: text('boyfriend_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  wifeId: text('wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  prizeTitle: text('prize_title').notNull(),
  emoji: text('emoji').notNull(),
  cost: integer('cost').notNull(),
  status: text('status').notNull(), // pending | fulfilled
  shared: boolean('shared').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
});

export const feed = pgTable('feed', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // earn | redeem
  boyfriendId: text('boyfriend_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  wifeId: text('wife_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  emoji: text('emoji').notNull(),
  points: integer('points').notNull(),
  note: text('note').notNull().default(''),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  likes: jsonb('likes').$type<string[]>().notNull().default([]),
  reactions: jsonb('reactions')
    .$type<{ emoji: string; userId: string }[]>()
    .notNull()
    .default([]),
  comments: jsonb('comments')
    .$type<
      {
        id: string;
        userId: string;
        name: string;
        avatarUrl?: string;
        text: string;
        createdAt: string;
      }[]
    >()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});
