import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
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
  listPersonas,
  fulfillRedemption,
  inviteBoyfriend,
  listFriends,
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
import {
  neonAuthEnv,
  verifyAppleIdentityToken,
  verifyNeonIdentityToken,
} from './identity.ts';

export interface CreateAppOptions {
  state: State;
  onChange?: (state: State) => void;
}

interface AuthedRequest extends Request {
  user?: User;
}

export function createApp({ state, onChange }: CreateAppOptions): Express {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PATCH,DELETE,OPTIONS',
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  const persist = () => onChange?.(state);

  const authenticate = (
    req: AuthedRequest,
    _res: Response,
    next: NextFunction,
  ) => {
    const header = req.header('authorization') ?? '';
    const tok = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    req.user = findByToken(state, tok);
    next();
  };
  app.use(authenticate);

  const requireAuth = (req: AuthedRequest, res: Response): User | null => {
    if (!req.user) {
      res.status(401).json({ error: 'Not signed in' });
      return null;
    }
    return req.user;
  };

  const requireWife = (req: AuthedRequest, res: Response): User | null => {
    const user = requireAuth(req, res);
    if (!user) return null;
    if (user.role !== 'wife') {
      res.status(403).json({ error: 'Only a wife can do that' });
      return null;
    }
    return user;
  };

  const fail = (res: Response, err: unknown) =>
    res.status(400).json({ error: (err as Error).message });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', users: state.users.length });
  });

  app.get('/api/suggestions', (_req, res) => {
    res.json({ prizes: PRIZE_SUGGESTIONS, tasks: TASK_SUGGESTIONS });
  });

  // --- Auth ---------------------------------------------------------------
  app.get('/api/auth/email-available', (req, res) => {
    const email = String(req.query.email ?? '').trim();
    if (!email.includes('@')) {
      res.status(400).json({ error: 'Enter a valid email' });
      return;
    }
    res.json({ available: !findByEmail(state, email) });
  });

  app.post('/api/auth/signup', (req, res) => {
    try {
      const roleRaw = String(req.body?.role ?? 'wife');
      const role = roleRaw === 'boyfriend' ? 'boyfriend' : 'wife';
      const user = signup(state, {
        name: String(req.body?.name ?? ''),
        email: String(req.body?.email ?? ''),
        password: String(req.body?.password ?? ''),
        role,
        coupleUsername: req.body?.coupleUsername
          ? String(req.body.coupleUsername)
          : undefined,
      });
      persist();
      res.status(201).json({ token: user.token, user: publicUser(state, user) });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const user = login(
        state,
        String(req.body?.email ?? ''),
        String(req.body?.password ?? ''),
      );
      persist();
      res.json({ token: user.token, user: publicUser(state, user) });
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  app.get('/api/personas', (_req, res) => {
    res.json(listPersonas(state));
  });

  app.post('/api/auth/device', (req, res) => {
    try {
      const user = deviceLogin(state, String(req.body?.userId ?? ''));
      persist();
      res.json({ token: user.token, user: publicUser(state, user) });
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/neon', async (req, res) => {
    try {
      const idToken = String(req.body?.idToken ?? '');
      if (!idToken) {
        res.status(400).json({ error: 'Missing Neon id token' });
        return;
      }
      const cfg = neonAuthEnv(process.env);
      const identity = await verifyNeonIdentityToken(idToken, {
        jwksUrl: cfg.jwksUrl,
        issuer: cfg.issuer,
      });
      const user = loginOrCreateFromIdentity(state, {
        email: identity.email,
        name: identity.name,
        provider: 'neon',
      });
      persist();
      res.json({ token: user.token, user: publicUser(state, user) });
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/apple', async (req, res) => {
    try {
      const idToken = String(req.body?.idToken ?? '');
      if (!idToken) {
        res.status(400).json({ error: 'Missing Apple id token' });
        return;
      }
      const clientId =
        process.env.APPLE_CLIENT_ID?.trim() ||
        process.env.VITE_APPLE_CLIENT_ID?.trim() ||
        '';
      if (!clientId) {
        res.status(503).json({
          error:
            'Apple Sign In is not configured. Set APPLE_CLIENT_ID (Services ID).',
        });
        return;
      }
      const identity = await verifyAppleIdentityToken(idToken, clientId);
      const user = loginOrCreateFromIdentity(state, {
        email: identity.email,
        name: String(req.body?.name ?? '').trim() || identity.name,
        provider: 'apple',
      });
      persist();
      res.json({ token: user.token, user: publicUser(state, user) });
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    if (req.user) {
      logout(req.user);
      persist();
    }
    res.status(204).end();
  });

  app.get('/api/me', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(publicUser(state, user));
  });

  app.patch('/api/me', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      updateProfile(user, { name: req.body?.name ? String(req.body.name) : undefined });
      persist();
      res.json(publicUser(state, user));
    } catch (err) {
      fail(res, err);
    }
  });

  // --- Onboarding ---------------------------------------------------------
  app.post('/api/onboarding/join', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const wife = joinWithInviteCode(
        state,
        user,
        String(req.body?.code ?? ''),
      );
      persist();
      res.json({
        user: publicUser(state, user),
        partner: publicUser(state, wife),
      });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/onboarding/boyfriend', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const bf = inviteBoyfriend(state, wife, {
        name: String(req.body?.name ?? ''),
        email: String(req.body?.email ?? ''),
        password: req.body?.password ? String(req.body.password) : undefined,
      });
      persist();
      res.status(201).json({
        boyfriend: publicUser(state, bf),
        partner: publicUser(state, bf),
        loginHint: { email: bf.email, password: bf.password },
      });
    } catch (err) {
      fail(res, err);
    }
  });

  app.delete('/api/partner', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      removePartner(state, wife);
      persist();
      res.json(publicUser(state, wife));
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/onboarding/friend', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const friend = addFriend(state, wife, {
        name: String(req.body?.name ?? ''),
        email: String(req.body?.email ?? ''),
      });
      persist();
      res.status(201).json(publicUser(state, friend));
    } catch (err) {
      fail(res, err);
    }
  });

  app.get('/api/friends', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    res.json(listFriends(state, wife));
  });

  app.get('/api/friend-requests', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      res.json(friendRequestsForUser(state, user));
    } catch (err) {
      fail(res, err);
    }
  });

  app.get('/api/couples/search', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      res.json(searchCouples(state, user, String(req.query.q ?? '')));
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/friend-requests', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const request = requestFriendByCode(
        state,
        user,
        String(req.body?.code ?? ''),
      );
      persist();
      res.status(201).json(request);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/friend-requests/:id/accept', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const request = resolveFriendRequest(state, user, req.params.id, true);
      persist();
      res.json(request);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/friend-requests/:id/decline', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const request = resolveFriendRequest(state, user, req.params.id, false);
      persist();
      res.json(request);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/friends', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const friend = addFriend(state, wife, {
        name: String(req.body?.name ?? ''),
        email: String(req.body?.email ?? ''),
      });
      persist();
      res.status(201).json(publicUser(state, friend));
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/onboarding/complete', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    completeOnboarding(user);
    persist();
    res.json(publicUser(state, user));
  });

  // --- Prizes -------------------------------------------------------------
  app.get('/api/prizes', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(prizesForUser(state, user));
  });

  app.post('/api/prizes', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const prize = addPrize(state, wife, {
        title: String(req.body?.title ?? ''),
        emoji: req.body?.emoji ? String(req.body.emoji) : undefined,
        cost: Number(req.body?.cost),
      });
      persist();
      res.status(201).json(prize);
    } catch (err) {
      fail(res, err);
    }
  });

  app.delete('/api/prizes/:id', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    if (!removePrize(state, wife, req.params.id)) {
      res.status(404).json({ error: 'Prize not found' });
      return;
    }
    persist();
    res.status(204).end();
  });

  // --- Earn tasks ---------------------------------------------------------
  app.get('/api/tasks', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(tasksForUser(state, user));
  });

  app.post('/api/tasks', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const task = addTask(state, wife, {
        title: String(req.body?.title ?? ''),
        emoji: req.body?.emoji ? String(req.body.emoji) : undefined,
        points: Number(req.body?.points),
      });
      persist();
      res.status(201).json(task);
    } catch (err) {
      fail(res, err);
    }
  });

  app.delete('/api/tasks/:id', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    if (!removeTask(state, wife, req.params.id)) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    persist();
    res.status(204).end();
  });

  // --- Submissions (earn requests) ---------------------------------------
  app.get('/api/submissions', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role === 'wife') {
      res.json(pendingSubmissionsForWife(state, user));
    } else {
      res.json(submissionsForBoyfriend(state, user));
    }
  });

  app.post('/api/submissions', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const submission = createSubmission(state, user, {
        title: String(req.body?.title ?? ''),
        emoji: req.body?.emoji ? String(req.body.emoji) : undefined,
        points: Number(req.body?.points),
        note: req.body?.note ? String(req.body.note) : undefined,
        images: Array.isArray(req.body?.images)
          ? req.body.images.map(String)
          : undefined,
      });
      persist();
      res.status(201).json(submission);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/submissions/:id/approve', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const revised =
        req.body?.points === undefined ? undefined : Number(req.body.points);
      const result = approveSubmission(state, wife, req.params.id, revised);
      persist();
      res.json(result);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/submissions/:id/deny', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const submission = denySubmission(state, wife, req.params.id);
      persist();
      res.json(submission);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/submissions/:id/share', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const submission = shareSubmission(state, user, req.params.id);
      persist();
      res.json(submission);
    } catch (err) {
      fail(res, err);
    }
  });

  // --- Redemptions --------------------------------------------------------
  app.get('/api/redemptions', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    res.json(pendingRedemptionsForWife(state, wife));
  });

  app.post('/api/redemptions', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const result = redeemPrize(state, user, String(req.body?.prizeId ?? ''));
      persist();
      res.status(201).json(result);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/redemptions/:id/fulfill', (req: AuthedRequest, res) => {
    const wife = requireWife(req, res);
    if (!wife) return;
    try {
      const redemption = fulfillRedemption(state, wife, req.params.id);
      persist();
      res.json(redemption);
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/redemptions/:id/share', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const result = shareRedemption(state, user, req.params.id);
      persist();
      res.json(result);
    } catch (err) {
      fail(res, err);
    }
  });

  // --- Feed ---------------------------------------------------------------
  app.get('/api/feed', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(feedForUser(state, user));
  });

  app.get('/api/notifications', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(buildNotifications(state, user));
  });

  app.post('/api/feed/:id/like', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const event = toggleLike(state, user, req.params.id);
      persist();
      res.json({ id: event.id, likes: event.likes.length, likedByMe: event.likes.includes(user.id) });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/feed/:id/react', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const event = reactToFeed(state, user, req.params.id, String(req.body?.emoji ?? ''));
      persist();
      res.json({ id: event.id, reactions: event.reactions });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/feed/:id/comment', (req: AuthedRequest, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const event = addComment(state, user, req.params.id, String(req.body?.text ?? ''));
      persist();
      res.json({ id: event.id, comments: event.comments });
    } catch (err) {
      fail(res, err);
    }
  });

  return app;
}
