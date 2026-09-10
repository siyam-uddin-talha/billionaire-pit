import { test, expect } from '@playwright/test';
test('arena shows distinct faces at close range without changing movement', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '01 START GAME' }).click();
  await page.getByRole('button', { name: 'CONFIRM FIGHTER' }).click();
  await expect(page.getByRole('button', { name: 'Pause fight' })).toBeVisible();
  for (const round of [0, 1]) {
    await page.evaluate((round) => {
      const g = (window as any).__pitTest;
      g.startRound(round, round ? 'dario_amodei' : 'elon_musk');
      g.setMode('fight');
      g.combat.cpu.update = () => ({ moveX: 0, moveZ: 0 });
      g.combat.fighters[0].x = -0.8;
      g.combat.fighters[1].x = 0.8;
    }, round);
    await page.waitForTimeout(2200);
    const state = await page.evaluate(() => {
      const g = (window as any).__pitTest;
      return {
        radius: g.camera.radius,
        heads: g.views.map((v: any) =>
          v.entries.skeletons
            .flatMap((s: any) => s.bones)
            .find((b: any) => b.name.endsWith('head'))
            .getTransformNode()
            .rotationQuaternion.asArray(),
        ),
      };
    });
    expect(state.radius).toBeLessThan(7.3);
    expect(state.heads.flat().every(Number.isFinite)).toBe(true);
    await page.waitForTimeout(700);
    const settled = await page.evaluate(() =>
      (window as any).__pitTest.views.map((v: any) =>
        v.head.rotationQuaternion.asArray(),
      ),
    );
    for (let side = 0; side < 2; side++)
      for (let axis = 0; axis < 4; axis++)
        expect(settled[side][axis]).toBeCloseTo(state.heads[side][axis], 6);
    await page.evaluate(() => (window as any).__pitTest.setMode('paused'));
    await page.waitForTimeout(500);
    const paused = await page.evaluate(() =>
      (window as any).__pitTest.views.map((v: any) =>
        v.head.rotationQuaternion.asArray(),
      ),
    );
    expect(paused).toEqual(settled);
  }
});
