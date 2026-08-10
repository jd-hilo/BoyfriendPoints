import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { createEmptyState } from './domain.ts';

function makeClient() {
  const app = createApp({ state: createEmptyState() });
  return request(app);
}

async function signupWife(client: ReturnType<typeof makeClient>) {
  const res = await client
    .post('/api/auth/signup')
    .send({ name: 'Wanda', email: 'wanda@x.com', password: 'secret' });
  return res.body.token as string;
}

describe('BoyfriendPoints API', () => {
  it('reports health', async () => {
    const res = await makeClient().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('runs the full couple flow end to end', async () => {
    const client = makeClient();
    const wifeToken = await signupWife(client);

    // Wife adds a prize and an earn task.
    await client
      .post('/api/prizes')
      .set('Authorization', `Bearer ${wifeToken}`)
      .send({ title: 'Movie night', cost: 100 })
      .expect(201);

    // Wife invites her boyfriend and logs him in.
    const invite = await client
      .post('/api/onboarding/boyfriend')
      .set('Authorization', `Bearer ${wifeToken}`)
      .send({ name: 'Ben', email: 'ben@x.com', password: 'pw' })
      .expect(201);
    expect(invite.body.loginHint.email).toBe('ben@x.com');

    const bfLogin = await client
      .post('/api/auth/login')
      .send({ email: 'ben@x.com', password: 'pw' })
      .expect(200);
    const bfToken = bfLogin.body.token as string;

    // Boyfriend submits a deed for points.
    const submission = await client
      .post('/api/submissions')
      .set('Authorization', `Bearer ${bfToken}`)
      .send({ title: 'Mowed the lawn', points: 150, note: 'edges too' })
      .expect(201);

    // Wife sees it as pending and approves it.
    const pending = await client
      .get('/api/submissions')
      .set('Authorization', `Bearer ${wifeToken}`)
      .expect(200);
    expect(pending.body).toHaveLength(1);

    await client
      .post(`/api/submissions/${submission.body.id}/approve`)
      .set('Authorization', `Bearer ${wifeToken}`)
      .expect(200);

    const me = await client
      .get('/api/me')
      .set('Authorization', `Bearer ${bfToken}`)
      .expect(200);
    expect(me.body.points).toBe(150);

    // Boyfriend redeems the prize; wife is alerted.
    const prizes = await client
      .get('/api/prizes')
      .set('Authorization', `Bearer ${bfToken}`)
      .expect(200);
    await client
      .post('/api/redemptions')
      .set('Authorization', `Bearer ${bfToken}`)
      .send({ prizeId: prizes.body[0].id })
      .expect(201);

    const alerts = await client
      .get('/api/redemptions')
      .set('Authorization', `Bearer ${wifeToken}`)
      .expect(200);
    expect(alerts.body).toHaveLength(1);
    expect(alerts.body[0].prizeTitle).toBe('Movie night');

    // Both earn + redeem show up in the feed.
    const feed = await client
      .get('/api/feed')
      .set('Authorization', `Bearer ${bfToken}`)
      .expect(200);
    expect(feed.body.map((f: { type: string }) => f.type).sort()).toEqual([
      'earn',
      'redeem',
    ]);
  });

  it('requires auth for protected routes', async () => {
    await makeClient().get('/api/feed').expect(401);
  });

  it('forbids a boyfriend from creating prizes', async () => {
    const client = makeClient();
    const wifeToken = await signupWife(client);
    await client
      .post('/api/onboarding/boyfriend')
      .set('Authorization', `Bearer ${wifeToken}`)
      .send({ name: 'Ben', email: 'ben@x.com', password: 'pw' });
    const bf = await client
      .post('/api/auth/login')
      .send({ email: 'ben@x.com', password: 'pw' });
    await client
      .post('/api/prizes')
      .set('Authorization', `Bearer ${bf.body.token}`)
      .send({ title: 'nope', cost: 10 })
      .expect(403);
  });
});
