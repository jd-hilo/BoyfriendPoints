import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { createEmptyState, seedDemoCompat } from './test-helpers.ts';

function makeClient() {
  const state = createEmptyState();
  seedDemoCompat(state);
  const app = createApp({ state });
  return { client: request(app), state };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('BoyfriendPoints API', () => {
  it('reports health', async () => {
    const { client } = makeClient();
    const res = await client.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.users).toBeGreaterThan(0);
  });

  it('lists personas and supports device login', async () => {
    const { client } = makeClient();
    const personas = await client.get('/api/personas').expect(200);
    expect(personas.body.length).toBeGreaterThan(0);
    const emma = personas.body.find(
      (p: { name: string }) => p.name === 'Emma',
    );
    expect(emma).toBeTruthy();

    const login = await client
      .post('/api/auth/device')
      .send({ userId: emma.id })
      .expect(200);
    expect(login.body.user.name).toBe('Emma');
    expect(login.body.token).toBeTruthy();

    const me = await client
      .get('/api/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.name).toBe('Emma');
  });

  it('refuses device login for real accounts even when demo auth is on', async () => {
    vi.stubEnv('ALLOW_DEMO_AUTH', '1');
    const { client, state } = makeClient();
    const real = state.users.find((u) => u.name === 'Emma')!;
    real.email = 'real.user@example.com';
    real.demo = false;
    await client
      .post('/api/auth/device')
      .send({ userId: real.id })
      .expect(404);
    const personas = await client.get('/api/personas').expect(200);
    expect(
      personas.body.find((p: { id: string }) => p.id === real.id),
    ).toBeUndefined();
  });

  it('disables persona listing and device login when demo auth is off', async () => {
    vi.stubEnv('ALLOW_DEMO_AUTH', '0');
    const { client, state } = makeClient();
    const emma = state.users.find((u) => u.name === 'Emma')!;
    const personas = await client.get('/api/personas').expect(200);
    expect(personas.body).toEqual([]);
    await client
      .post('/api/auth/device')
      .send({ userId: emma.id })
      .expect(403);
  });

  it('runs the couple flow with mock personas', async () => {
    const { client } = makeClient();
    const personas = await client.get('/api/personas');
    const emma = personas.body.find((p: { name: string }) => p.name === 'Emma');
    const noah = personas.body.find((p: { name: string }) => p.name === 'Noah');

    const wife = await client
      .post('/api/auth/device')
      .send({ userId: emma.id });
    const bf = await client.post('/api/auth/device').send({ userId: noah.id });

    // Emma sees pending requests from seed.
    const pending = await client
      .get('/api/submissions')
      .set('Authorization', `Bearer ${wife.body.token}`)
      .expect(200);
    expect(pending.body.length).toBeGreaterThan(0);

    // Approve one.
    await client
      .post(`/api/submissions/${pending.body[0].id}/approve`)
      .set('Authorization', `Bearer ${wife.body.token}`)
      .expect(200);

    // Noah can see a populated feed.
    const feed = await client
      .get('/api/feed')
      .set('Authorization', `Bearer ${bf.body.token}`)
      .expect(200);
    expect(feed.body.length).toBeGreaterThan(0);

    // Noah can redeem a prize he can afford.
    const prizes = await client
      .get('/api/prizes')
      .set('Authorization', `Bearer ${bf.body.token}`)
      .expect(200);
    const affordable = prizes.body.find(
      (p: { cost: number }) => p.cost <= bf.body.user.points + pending.body[0].points,
    );
    expect(affordable).toBeTruthy();
    await client
      .post('/api/redemptions')
      .set('Authorization', `Bearer ${bf.body.token}`)
      .send({ prizeId: affordable.id })
      .expect(201);
  });

  it('lets a partner grant points without a request', async () => {
    const { client } = makeClient();
    const personas = await client.get('/api/personas');
    const emma = personas.body.find((p: { name: string }) => p.name === 'Emma');
    const noah = personas.body.find((p: { name: string }) => p.name === 'Noah');
    const wife = await client
      .post('/api/auth/device')
      .send({ userId: emma.id });
    const bf = await client.post('/api/auth/device').send({ userId: noah.id });
    const before = bf.body.user.points as number;

    const granted = await client
      .post('/api/submissions/grant')
      .set('Authorization', `Bearer ${wife.body.token}`)
      .send({ title: 'Took out the trash', emoji: '🗑️', points: 12 })
      .expect(201);
    expect(granted.body.submission.status).toBe('approved');
    expect(granted.body.submission.granted).toBe(true);
    expect(granted.body.submission.boyfriendId).toBe(noah.id);

    const me = await client
      .get('/api/me')
      .set('Authorization', `Bearer ${bf.body.token}`)
      .expect(200);
    expect(me.body.points).toBe(before + 12);

    const notifs = await client
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bf.body.token}`)
      .expect(200);
    expect(
      (notifs.body as { kind: string }[]).some((n) => n.kind === 'granted'),
    ).toBe(true);
  });

  it('opens a person peek from the feed circle', async () => {
    const { client } = makeClient();
    const personas = await client.get('/api/personas');
    const emma = personas.body.find((p: { name: string }) => p.name === 'Emma');
    const noah = personas.body.find((p: { name: string }) => p.name === 'Noah');
    const wife = await client
      .post('/api/auth/device')
      .send({ userId: emma.id });

    const peek = await client
      .get(`/api/people/${noah.id}`)
      .set('Authorization', `Bearer ${wife.body.token}`)
      .expect(200);
    expect(peek.body.name).toBe('Noah');
    expect(peek.body.partnerName).toBe('Emma');
    expect(peek.body.email).toBeUndefined();
    expect(Array.isArray(peek.body.activity)).toBe(true);
  });

  it('reports, blocks, and deletes a real account', async () => {
    const { client, state } = makeClient();
    const emma = state.users.find((u) => u.name === 'Emma')!;
    const noah = state.users.find((u) => u.name === 'Noah')!;
    const emmaLogin = await client
      .post('/api/auth/device')
      .send({ userId: emma.id })
      .expect(200);

    await client
      .delete('/api/account')
      .set('Authorization', `Bearer ${emmaLogin.body.token}`)
      .expect(400);

    await client
      .post('/api/blocks')
      .set('Authorization', `Bearer ${emmaLogin.body.token}`)
      .send({ userId: noah.id })
      .expect(400);

    const created = await client
      .post('/api/auth/signup')
      .send({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret-pass',
        role: 'wife',
      })
      .expect(201);
    const token = created.body.token as string;
    const ada = state.users.find((u) => u.email === 'ada@example.com')!;
    const community = state.users.find((u) => u.demo && u.role === 'wife')!;

    const invited = await client
      .post('/api/onboarding/boyfriend')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ben', email: 'ben@example.com', password: 'secret-pass' })
      .expect(201);
    expect(invited.body.loginHint.password).toBe('secret-pass');

    ada.friendIds = [community.id];
    community.friendIds = [...community.friendIds, ada.id];

    await client
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'user', targetId: community.id, reason: 'Spam' })
      .expect(201);
    expect(state.reports).toHaveLength(1);

    await client
      .post('/api/blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: community.id })
      .expect(201);
    const blocks = await client
      .get('/api/blocks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(blocks.body.map((person: { id: string }) => person.id)).toContain(
      community.id,
    );

    await client
      .delete('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(state.users.some((u) => u.id === ada.id)).toBe(false);
    await client
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'secret-pass' })
      .expect(401);
  });

  it('requires auth for protected routes', async () => {
    const { client } = makeClient();
    await client.get('/api/feed').expect(401);
  });

  it('emails a reset code through Neon Auth', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.com/neondb/auth');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const { client } = makeClient();
    const res = await client
      .post('/api/auth/forgot-password')
      .send({ email: 'emma@boyfriendpoints.app' })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/email-otp/request-password-reset',
    );
  });

  it('updates the app password after Neon accepts the code', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.com/neondb/auth');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const { client, state } = makeClient();
    const emma = state.users.find((u) => u.name === 'Emma');
    expect(emma).toBeTruthy();
    await client
      .post('/api/auth/reset-password')
      .send({
        email: emma!.email,
        otp: '123456',
        password: 'brand-new-pass',
      })
      .expect(200);
    expect(emma!.password).toBe('brand-new-pass');
  });
});
