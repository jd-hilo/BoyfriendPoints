import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { createEmptyState } from './points.ts';

function makeClient() {
  const app = createApp({ state: createEmptyState() });
  return request(app);
}

describe('BoyfriendPoints API', () => {
  it('reports health', async () => {
    const res = await makeClient().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('creates a boyfriend and awards points end to end', async () => {
    const client = makeClient();

    const created = await client
      .post('/api/boyfriends')
      .send({ name: 'Taylor' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const awarded = await client
      .post(`/api/boyfriends/${id}/points`)
      .send({ delta: 15, reason: 'Surprise flowers' });
    expect(awarded.status).toBe(200);
    expect(awarded.body.boyfriend.points).toBe(15);

    const list = await client.get('/api/boyfriends');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].points).toBe(15);

    const history = await client.get(`/api/boyfriends/${id}/history`);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].reason).toBe('Surprise flowers');
  });

  it('rejects a duplicate boyfriend', async () => {
    const client = makeClient();
    await client.post('/api/boyfriends').send({ name: 'Pat' });
    const dup = await client.post('/api/boyfriends').send({ name: 'pat' });
    expect(dup.status).toBe(400);
  });
});
