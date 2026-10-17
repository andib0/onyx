import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let id: string;
let foodId: string;

beforeAll(async () => {
  H = auth(await registerUser());
  foodId = (
    await prisma.food.create({
      data: {
        name: `Meals test rice ${Date.now()}`,
        proteinPer100g: 7,
        caloriesPer100g: 130,
      },
    })
  ).id;
});

describe('/api/meals', () => {
  it('POST /templates creates; rejects a missing name', async () => {
    const res = await http()
      .post('/api/meals/templates')
      .set(H)
      .send({
        dayOfWeek: 'Mon',
        name: 'Rice bowl',
        foodId,
        grams: 100,
        tags: [{ label: 'Protein', value: '7' }],
      });
    expect(res.status).toBe(201);
    id = res.body.data.id;
    expect(
      (await http().post('/api/meals/templates').set(H).send({ dayOfWeek: 'Mon' })).status
    ).toBe(400);
  });

  it('GET /templates lists (optionally by day); 401 without a token', async () => {
    const res = await http().get('/api/meals/templates?day=Mon').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((await http().get('/api/meals/templates')).status).toBe(401);
  });

  it('PUT /templates/:id replaces tags; rejects a bad grams value', async () => {
    const res = await http()
      .put(`/api/meals/templates/${id}`)
      .set(H)
      .send({ name: 'Big rice bowl', tags: [{ label: 'Carbs', value: '28' }] });
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toHaveLength(1);
    expect(res.body.data.tags[0].label).toBe('Carbs');
    expect(
      (await http().put(`/api/meals/templates/${id}`).set(H).send({ grams: -1 })).status
    ).toBe(400);
  });

  it('PATCH /templates/:id/grams recomputes macros; rejects a missing value', async () => {
    const res = await http()
      .patch(`/api/meals/templates/${id}/grams`)
      .set(H)
      .send({ grams: 200 });
    expect(res.status).toBe(200);
    // Tags stay per 100 g (the convention the app and the server score use);
    // only `grams` carries the portion, so macros are scaled exactly once.
    const protein = res.body.data.tags.find(
      (t: { label: string }) => t.label === 'Protein'
    );
    expect(protein.value).toBe('7');
    expect(Number(res.body.data.grams)).toBe(200);
    expect(
      (await http().patch(`/api/meals/templates/${id}/grams`).set(H).send({})).status
    ).toBe(400);
  });

  it('PATCH grams then eat: /today counts the portion once (no double scaling)', async () => {
    const created = await http()
      .post('/api/meals/templates')
      .set(H)
      .send({
        dayOfWeek: 'Monday',
        name: 'Rice portion',
        foodId,
        grams: 100,
        tags: [
          { label: 'Protein', value: '7' },
          { label: 'Calories', value: '130' },
        ],
      });
    expect(created.status).toBe(201);
    const tid = created.body.data.id;
    const patched = await http()
      .patch(`/api/meals/templates/${tid}/grams`)
      .set(H)
      .send({ grams: 250 });
    expect(patched.status).toBe(200);
    const monday = '2026-10-12';
    expect(
      (
        await http()
          .post(`/api/meals/${tid}/log`)
          .set(H)
          .send({ date: monday, isEaten: true })
      ).status
    ).toBeLessThan(300);
    const today = await http().get(`/api/today?date=${monday}`).set(H);
    expect(today.status).toBe(200);
    const meal = today.body.data.meals.templates.find(
      (t: { id: string }) => t.id === tid
    );
    // 7 g protein / 100 g × 250 g = 17.5 g; 130 kcal / 100 g × 250 g = 325 kcal
    expect(meal.macros.protein).toBe(17.5);
    expect(meal.macros.calories).toBe(325);
    expect(today.body.data.meals.consumed.protein).toBe(17.5);
  });

  it('POST /:id/log toggles; GET /logs reads; validation failures', async () => {
    const log = await http()
      .post(`/api/meals/${id}/log`)
      .set(H)
      .send({ date: '2026-10-17', isEaten: true });
    expect(log.status).toBe(200);
    const logs = await http().get('/api/meals/logs?date=2026-10-17').set(H);
    expect(logs.status).toBe(200);
    expect(logs.body.data).toHaveLength(1);
    expect(
      (await http().post(`/api/meals/${id}/log`).set(H).send({ isEaten: true })).status
    ).toBe(400);
    expect((await http().get('/api/meals/logs?date=17-10-2026').set(H)).status).toBe(400);
  });

  it('DELETE /templates/:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/meals/templates/${id}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/meals/templates/${id}`).set(H)).status).toBe(404);
  });
});
