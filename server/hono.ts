import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { User } from '../shared/types.ts';
import {
  addComment,
  addFriend,
  addPrize,
  addTask,
  approveSubmission,
  buildNotifications,
  completeOnboarding,
  createSubmission,
  denySubmission,
  deviceLogin,
  feedForUser,
  friendRequestsForUser,
  findByEmail,
  findByToken,
  fulfillRedemption,
  inviteBoyfriend,
  listFriends,
  listPersonas,
  login,
  loginOrCreateFromIdentity,
  logout,
  PRIZE_SUGGESTIONS,
  pendingRedemptionsForWife,
  pendingSubmissionsForWife,
  prizesForUser,
  publicUser,
  requestFriendByCode,
  resolveFriendRequest,
  searchCouples,
  reactToFeed,
  redeemPrize,
  removePartner,
  removePrize,
  removeTask,
  shareRedemption,
  shareSubmission,
  signup,
  joinWithInviteCode,
  updateProfile,
  submissionsForBoyfriend,
  TASK_SUGGESTIONS,
  tasksForUser,
  toggleLike,
  type State,
} from './domain.ts';
import { createDb, type Database } from './db/client.ts';
import { loadState, saveState } from './db/store.ts';
import {
  neonAuthEnv,
  verifyAppleIdentityToken,
  verifyNeonIdentityToken,
} from './identity.ts';

export type WorkerEnv = {
  DATABASE_URL: string;
  NEON_AUTH_URL?: string;
  NEON_JWKS_URL?: string;
  APPLE_CLIENT_ID?: string;
};

type Variables = {
  db: Database;
  state: State;
  dirty: boolean;
  user?: User;
};

export function createApiApp() {
  const app = new Hono<{ Bindings: WorkerEnv; Variables: Variables }>();
  const processEnv =
    typeof process !== 'undefined' && process.env ? process.env : {};

  app.use('/api/*', cors());

  app.use('/api/*', async (c, next) => {
    try {
      const databaseUrl = c.env?.DATABASE_URL;
      if (!databaseUrl) {
        return c.json({ error: 'DATABASE_URL is not configured on the Worker' }, 500);
      }
      const db = createDb(databaseUrl);
      const state = await loadState(db);
      c.set('db', db);
      c.set('state', state);
      c.set('dirty', false);

      const header = c.req.header('authorization') ?? '';
      const tok = header.startsWith('Bearer ') ? header.slice(7) : undefined;
      c.set('user', findByToken(state, tok));

      await next();

      if (c.get('dirty')) {
        await saveState(db, state);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('api middleware failed', message);
      return c.json({ error: message }, 500);
    }
  });

  const markDirty = (c: { set: (k: 'dirty', v: boolean) => void }) =>
    c.set('dirty', true);

  app.get('/api/health', (c) => {
    const state = c.get('state');
    return c.json({ status: 'ok', users: state.users.length });
  });

  app.get('/api/suggestions', (c) =>
    c.json({ prizes: PRIZE_SUGGESTIONS, tasks: TASK_SUGGESTIONS }),
  );

  app.get('/api/personas', (c) => c.json(listPersonas(c.get('state'))));

  app.post('/api/auth/device', async (c) => {
    try {
      const body = await c.req.json<{ userId?: string }>();
      const user = deviceLogin(c.get('state'), String(body?.userId ?? ''));
      markDirty(c);
      return c.json({
        token: user.token,
        user: publicUser(c.get('state'), user),
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  app.post('/api/auth/neon', async (c) => {
    try {
      const body = await c.req.json<{ idToken?: string }>();
      const idToken = String(body?.idToken ?? '');
      if (!idToken) return c.json({ error: 'Missing Neon id token' }, 400);
      const cfg = neonAuthEnv({
        NEON_AUTH_URL: c.env.NEON_AUTH_URL ?? processEnv.NEON_AUTH_URL,
        NEON_JWKS_URL: c.env.NEON_JWKS_URL ?? processEnv.NEON_JWKS_URL,
        VITE_NEON_AUTH_URL: processEnv.VITE_NEON_AUTH_URL,
      });
      const identity = await verifyNeonIdentityToken(idToken, {
        jwksUrl: cfg.jwksUrl,
        issuer: cfg.issuer,
      });
      const user = loginOrCreateFromIdentity(c.get('state'), {
        email: identity.email,
        name: identity.name,
        provider: 'neon',
      });
      markDirty(c);
      return c.json({
        token: user.token,
        user: publicUser(c.get('state'), user),
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 401);
    }
  });

  app.post('/api/auth/apple', async (c) => {
    try {
      const body = await c.req.json<{
        idToken?: string;
        name?: string;
      }>();
      const idToken = String(body?.idToken ?? '');
      if (!idToken) return c.json({ error: 'Missing Apple id token' }, 400);
      const clientId =
        c.env.APPLE_CLIENT_ID?.trim() ||
        processEnv.APPLE_CLIENT_ID?.trim() ||
        processEnv.VITE_APPLE_CLIENT_ID?.trim() ||
        '';
      if (!clientId) {
        return c.json(
          {
            error:
              'Apple Sign In is not configured. Set APPLE_CLIENT_ID (Services ID) on the server.',
          },
          503,
        );
      }
      const identity = await verifyAppleIdentityToken(idToken, clientId);
      const user = loginOrCreateFromIdentity(c.get('state'), {
        email: identity.email,
        name: body?.name?.trim() || identity.name,
        provider: 'apple',
      });
      markDirty(c);
      return c.json({
        token: user.token,
        user: publicUser(c.get('state'), user),
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 401);
    }
  });

  app.get('/api/auth/email-available', (c) => {
    const email = String(c.req.query('email') ?? '').trim();
    if (!email.includes('@')) {
      return c.json({ error: 'Enter a valid email' }, 400);
    }
    return c.json({ available: !findByEmail(c.get('state'), email) });
  });

  app.post('/api/auth/signup', async (c) => {
    try {
      const body = await c.req.json<{
        name?: string;
        email?: string;
        password?: string;
        role?: string;
        coupleUsername?: string;
      }>();
      const role = body?.role === 'boyfriend' ? 'boyfriend' : 'wife';
      const user = signup(c.get('state'), {
        name: String(body?.name ?? ''),
        email: String(body?.email ?? ''),
        password: String(body?.password ?? ''),
        role,
        coupleUsername: body?.coupleUsername
          ? String(body.coupleUsername)
          : undefined,
      });
      markDirty(c);
      return c.json(
        { token: user.token, user: publicUser(c.get('state'), user) },
        201,
      );
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/auth/login', async (c) => {
    try {
      const body = await c.req.json<{ email?: string; password?: string }>();
      const user = login(
        c.get('state'),
        String(body?.email ?? ''),
        String(body?.password ?? ''),
      );
      markDirty(c);
      return c.json({
        token: user.token,
        user: publicUser(c.get('state'), user),
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 401);
    }
  });

  app.post('/api/auth/logout', (c) => {
    const user = c.get('user');
    if (user) {
      logout(user);
      markDirty(c);
    }
    return c.body(null, 204);
  });

  app.get('/api/me', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    return c.json(publicUser(c.get('state'), user));
  });

  app.patch('/api/me', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{ name?: string }>();
      updateProfile(user, {
        name: body?.name ? String(body.name) : undefined,
      });
      markDirty(c);
      return c.json(publicUser(c.get('state'), user));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/onboarding/join', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{ code?: string }>();
      const wife = joinWithInviteCode(
        c.get('state'),
        user,
        String(body?.code ?? ''),
      );
      markDirty(c);
      return c.json({
        user: publicUser(c.get('state'), user),
        partner: publicUser(c.get('state'), wife),
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/onboarding/boyfriend', async (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const body = await c.req.json<{
        name?: string;
        email?: string;
        password?: string;
      }>();
      const bf = inviteBoyfriend(c.get('state'), wife, {
        name: String(body?.name ?? ''),
        email: String(body?.email ?? ''),
        password: body?.password ? String(body.password) : undefined,
      });
      markDirty(c);
      return c.json(
        {
          boyfriend: publicUser(c.get('state'), bf),
          partner: publicUser(c.get('state'), bf),
          loginHint: { email: bf.email, password: bf.password },
        },
        201,
      );
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.delete('/api/partner', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      removePartner(c.get('state'), wife);
      markDirty(c);
      return c.json(publicUser(c.get('state'), wife));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/onboarding/friend', async (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const body = await c.req.json<{ name?: string; email?: string }>();
      const friend = addFriend(c.get('state'), wife, {
        name: String(body?.name ?? ''),
        email: String(body?.email ?? ''),
      });
      markDirty(c);
      return c.json(publicUser(c.get('state'), friend), 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get('/api/friends', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    return c.json(listFriends(c.get('state'), wife));
  });

  app.get('/api/friend-requests', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      return c.json(friendRequestsForUser(c.get('state'), user));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get('/api/couples/search', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      return c.json(searchCouples(c.get('state'), user, c.req.query('q') ?? ''));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/friend-requests', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{ code?: string }>();
      const request = requestFriendByCode(
        c.get('state'),
        user,
        String(body?.code ?? ''),
      );
      markDirty(c);
      return c.json(request, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/friend-requests/:id/accept', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const request = resolveFriendRequest(
        c.get('state'),
        user,
        c.req.param('id'),
        true,
      );
      markDirty(c);
      return c.json(request);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/friend-requests/:id/decline', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const request = resolveFriendRequest(
        c.get('state'),
        user,
        c.req.param('id'),
        false,
      );
      markDirty(c);
      return c.json(request);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/friends', async (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const body = await c.req.json<{ name?: string; email?: string }>();
      const friend = addFriend(c.get('state'), wife, {
        name: String(body?.name ?? ''),
        email: String(body?.email ?? ''),
      });
      markDirty(c);
      return c.json(publicUser(c.get('state'), friend), 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/onboarding/complete', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    completeOnboarding(user);
    markDirty(c);
    return c.json(publicUser(c.get('state'), user));
  });

  app.get('/api/prizes', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    return c.json(prizesForUser(c.get('state'), user));
  });

  app.post('/api/prizes', async (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const body = await c.req.json<{
        title?: string;
        emoji?: string;
        cost?: number;
      }>();
      const prize = addPrize(c.get('state'), wife, {
        title: String(body?.title ?? ''),
        emoji: body?.emoji ? String(body.emoji) : undefined,
        cost: Number(body?.cost),
      });
      markDirty(c);
      return c.json(prize, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.delete('/api/prizes/:id', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    if (!removePrize(c.get('state'), wife, c.req.param('id'))) {
      return c.json({ error: 'Prize not found' }, 404);
    }
    markDirty(c);
    return c.body(null, 204);
  });

  app.get('/api/tasks', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    return c.json(tasksForUser(c.get('state'), user));
  });

  app.post('/api/tasks', async (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const body = await c.req.json<{
        title?: string;
        emoji?: string;
        points?: number;
      }>();
      const task = addTask(c.get('state'), wife, {
        title: String(body?.title ?? ''),
        emoji: body?.emoji ? String(body.emoji) : undefined,
        points: Number(body?.points),
      });
      markDirty(c);
      return c.json(task, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.delete('/api/tasks/:id', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    if (!removeTask(c.get('state'), wife, c.req.param('id'))) {
      return c.json({ error: 'Task not found' }, 404);
    }
    markDirty(c);
    return c.body(null, 204);
  });

  app.get('/api/submissions', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    const state = c.get('state');
    return c.json(
      user.role === 'wife'
        ? pendingSubmissionsForWife(state, user)
        : submissionsForBoyfriend(state, user),
    );
  });

  app.post('/api/submissions', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{
        title?: string;
        emoji?: string;
        points?: number;
        note?: string;
        images?: string[];
      }>();
      const submission = createSubmission(c.get('state'), user, {
        title: String(body?.title ?? ''),
        emoji: body?.emoji ? String(body.emoji) : undefined,
        points: Number(body?.points),
        note: body?.note ? String(body.note) : undefined,
        images: Array.isArray(body?.images)
          ? body.images.map(String)
          : undefined,
      });
      markDirty(c);
      return c.json(submission, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/submissions/:id/approve', async (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const body = await c.req.json<{ points?: number }>().catch(() => ({}));
      const revised =
        (body as { points?: number })?.points === undefined
          ? undefined
          : Number((body as { points?: number }).points);
      const result = approveSubmission(
        c.get('state'),
        wife,
        c.req.param('id'),
        revised,
      );
      markDirty(c);
      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/submissions/:id/deny', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const submission = denySubmission(
        c.get('state'),
        wife,
        c.req.param('id'),
      );
      markDirty(c);
      return c.json(submission);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/submissions/:id/share', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const submission = shareSubmission(
        c.get('state'),
        user,
        c.req.param('id'),
      );
      markDirty(c);
      return c.json(submission);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get('/api/redemptions', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    return c.json(pendingRedemptionsForWife(c.get('state'), wife));
  });

  app.post('/api/redemptions', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{ prizeId?: string }>();
      const result = redeemPrize(
        c.get('state'),
        user,
        String(body?.prizeId ?? ''),
      );
      markDirty(c);
      return c.json(result, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/redemptions/:id/fulfill', (c) => {
    const wife = c.get('user');
    if (!wife) return c.json({ error: 'Not signed in' }, 401);
    if (wife.role !== 'wife') return c.json({ error: 'Only a wife can do that' }, 403);
    try {
      const redemption = fulfillRedemption(
        c.get('state'),
        wife,
        c.req.param('id'),
      );
      markDirty(c);
      return c.json(redemption);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/redemptions/:id/share', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const result = shareRedemption(
        c.get('state'),
        user,
        c.req.param('id'),
      );
      markDirty(c);
      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get('/api/feed', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    return c.json(feedForUser(c.get('state'), user));
  });

  app.get('/api/notifications', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    return c.json(buildNotifications(c.get('state'), user));
  });

  app.post('/api/feed/:id/like', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const event = toggleLike(c.get('state'), user, c.req.param('id'));
      markDirty(c);
      return c.json({
        id: event.id,
        likes: event.likes.length,
        likedByMe: event.likes.includes(user.id),
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/feed/:id/react', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{ emoji?: string }>();
      const event = reactToFeed(
        c.get('state'),
        user,
        c.req.param('id'),
        String(body?.emoji ?? ''),
      );
      markDirty(c);
      return c.json({ id: event.id, reactions: event.reactions });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post('/api/feed/:id/comment', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    try {
      const body = await c.req.json<{ text?: string }>();
      const event = addComment(
        c.get('state'),
        user,
        c.req.param('id'),
        String(body?.text ?? ''),
      );
      markDirty(c);
      return c.json({ id: event.id, comments: event.comments });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  return app;
}
