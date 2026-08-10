import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { createEmptyState, seedDemoCompat } from './test-helpers.ts';

function makeClient() {
  const state = createEmptyState();
  seedDemoCompat(state);
  const app = createApp({ state });
  return { client: request(app), state };
}

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

  it('requires auth for protected routes', async () => {
    const { client } = makeClient();
    await client.get('/api/feed').expect(401);
  });
});
