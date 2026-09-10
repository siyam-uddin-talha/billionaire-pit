import { test, expect } from '@playwright/test';
test('loading, roster, settings persistence, eligibility, controls and pause', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '01 START GAME' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /02 LOAD GAME/ }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Next fighter' }).click();
  await expect(
    page.getByRole('heading', { name: 'MARK ZUCKERBERG' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '03 SETTINGS' }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'BACK TO THE PIT' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sound Off' })).toBeVisible();
  await page.getByRole('button', { name: '01 START GAME' }).click();
  await expect(
    page.getByRole('button', { name: 'Select Elon Musk', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Dario Amodei', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Select Mark Zuckerberg', exact: true })
    .click();
  await page.getByRole('button', { name: 'CONFIRM FIGHTER' }).click();
  await expect(page.locator('.player-hud .hud-name')).toContainText(
    'Mark Zuckerberg',
  );
  await expect(page.locator('.cpu-hud .hud-name')).toContainText('Elon Musk');
  await expect(page.getByRole('button', { name: 'Pause fight' })).toBeVisible();
  const screenSides = await page.evaluate(() => {
    const game = (window as any).__pitTest;
    return game.views.map(
      (view: any) =>
        view.root.position.constructor.TransformCoordinates(
          view.root.position,
          game.camera.getViewMatrix(),
        ).x,
    );
  });
  expect(screenSides[0]).toBeLessThan(0);
  expect(screenSides[1]).toBeGreaterThan(0);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(280);
  await page.keyboard.up('KeyD');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(i % 2 ? 'KeyJ' : 'KeyK');
    await page.waitForTimeout(600);
  }
  await expect
    .poll(async () =>
      Number(await page.locator('.cpu-hud .hud-name b').textContent()),
    )
    .toBeLessThan(100);
  await page.keyboard.down('KeyL');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyL');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Pause fight' }).click();
  const clock = await page.locator('.timer strong').textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator('.timer strong')).toHaveText(clock!);
  await page.getByRole('button', { name: 'RESUME FIGHT' }).click();
  await expect(page.getByRole('button', { name: 'Pause fight' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause fight' }).click();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /02 LOAD GAME/ }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
test('tablet fits its viewport and phones show the supported-size message', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 600 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '01 START GAME' }),
  ).toBeVisible();
  const metrics = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  expect(metrics.w).toBe(768);
  expect(metrics.h).toBeLessThanOrEqual(601);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'A bigger stage is required.' }),
  ).toBeVisible();
});
test('valid round-two checkpoint resumes eligible fighters; corrupt save is ignored', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'billionaire-pit-save',
      JSON.stringify({
        version: 1,
        round: 1,
        fighter: 'dario_amodei',
        savedAt: '2026-09-09T00:00:00Z',
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /02 LOAD GAME/ }).click();
  await expect(
    page.getByRole('heading', { name: 'DARIO AMODEI' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Sam Altman', exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem('billionaire-pit-save', 'corrupt'),
  );
  await page.getByRole('button', { name: 'BACK TO MENU' }).click();
  await page.getByRole('button', { name: /02 LOAD GAME/ }).click();
  await expect(
    page.getByRole('button', { name: /02 LOAD GAME/ }),
  ).toBeDisabled();
});
test('winning all three rounds checkpoints the next round and reaches the trophy ceremony', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '01 START GAME' }).click();
  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: 'CONFIRM FIGHTER' }).click();
    await expect(
      page.getByRole('button', { name: 'Pause fight' }),
    ).toBeVisible();
    // Fixture forces only the result boundary. Real damage/contact is covered by physics.test.ts.
    await page.evaluate(() => {
      const game = (window as any).__pitTest;
      game.combat.finish(0, 'K.O.');
      game.onSnapshot(game.combat.snapshot());
      game.onResult(game.combat.snapshot());
    });
    await expect(page.locator('.result-winner')).toContainText('YOU WIN');
    if (round < 2) {
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('billionaire-pit-save')!).round,
          ),
        )
        .toBe(round + 1);
      await page.getByRole('button', { name: 'NEXT ROUND' }).click();
      await expect(
        page.getByRole('button', { name: 'Select Dario Amodei', exact: true }),
      ).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'CLAIM THE TROPHY' }).click();
      await expect(
        page.getByRole('heading', { name: 'BILLIONAIRE PIT CHAMPION.' }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem('billionaire-pit-save')),
      ).toBeNull();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/billionaire-trophy.png' });
      const clip = await page.evaluate(
        () => (window as any).__pitTest.views[0].action,
      );
      expect(clip).toBe('trophy_lift');
    }
  }
  await expect(page.getByRole('button', { name: 'PLAY AGAIN' })).toBeVisible();
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await expect(
    page.getByRole('button', { name: 'Select Elon Musk', exact: true }),
  ).toBeVisible();
});

test('losses require rematches in both opening rounds and wins preserve finalists', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '01 START GAME' }).click();
  await page
    .getByRole('button', { name: 'Select Mark Zuckerberg', exact: true })
    .click();
  for (const round of [0, 1]) {
    await page.getByRole('button', { name: 'CONFIRM FIGHTER' }).click();
    await expect(
      page.getByRole('button', { name: 'Pause fight' }),
    ).toBeVisible();
    await page.evaluate(() => {
      const game = (window as any).__pitTest;
      game.combat.finish(1, 'K.O.');
      game.onSnapshot(game.combat.snapshot());
      game.onResult(game.combat.snapshot());
    });
    await expect(page.getByRole('button', { name: 'NEXT ROUND' })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('billionaire-pit-save')!).round,
      ),
    ).toBe(round);
    await page.getByRole('button', { name: 'REMATCH', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Pause fight' }),
    ).toBeVisible();
    await page.evaluate((side) => {
      const game = (window as any).__pitTest;
      game.combat.finish(side, 'K.O.');
      game.onSnapshot(game.combat.snapshot());
      game.onResult(game.combat.snapshot());
    }, 0);
    await page.getByRole('button', { name: 'NEXT ROUND' }).click();
  }
  await expect(page.locator('.matchup-card')).toContainText('Dario Amodei');
  await expect(page.locator('.matchup-card')).toContainText('Mark Zuckerberg');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('billionaire-pit-save')!).winners,
    ),
  ).toEqual(['mark_zuckerberg', 'dario_amodei']);
  await page.reload();
  await page.getByRole('button', { name: /02 LOAD GAME/ }).click();
  await expect(page.locator('.matchup-card')).toContainText('Dario Amodei');
  await expect(page.locator('.matchup-card')).toContainText('Mark Zuckerberg');
  await expect(page.locator('.fighter-skills')).toHaveCount(0);
  await page.getByRole('button', { name: 'CONFIRM FIGHTER' }).click();
  await expect(page.getByRole('button', { name: 'Pause fight' })).toBeVisible();
  await expect(page.locator('.player-hud')).toContainText('Dario');
});

test('championship cup stays in every champion’s glove during the lift', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '01 START GAME' }),
  ).toBeVisible();
  for (const id of [
    'elon_musk',
    'mark_zuckerberg',
    'dario_amodei',
    'sam_altman',
  ]) {
    await page.evaluate((id) => {
      const game = (window as any).__pitTest;
      game.selected = id;
      game.setMode('trophy');
    }, id);
    for (const delay of [150, 1100, 2100]) {
      await page.waitForTimeout(delay);
      const held = await page.evaluate(() => {
        const game = (window as any).__pitTest;
        const hands = game.views[0].entries.skeletons
          .flatMap((s: any) => s.bones)
          .filter((b: any) => /hand\.[LR]$/.test(b.name))
          .map((b: any) => b.getTransformNode());
        const V = hands[0].position.constructor;
        const distances = hands.map((hand: any) => {
          const sign = hand.getAbsolutePosition().x >= 0 ? 1 : -1;
          const handle = V.TransformCoordinates(
            new V(sign * 0.43, 0.53, 0),
            game.trophy.getWorldMatrix(),
          );
          return V.Distance(handle, hand.getAbsolutePosition());
        });
        return {
          distance: Math.max(...distances),
          winnerName: game.trophy.metadata.winnerName,
          height: game.trophy.position.y,
          cup: game.trophy
            .getChildMeshes()
            .some((m: any) => m.name === 'Hollow spun gold cup'),
        };
      });
      expect(held.distance).toBeLessThan(0.015);
      expect(held.height).toBeGreaterThan(0.4);
      expect(held.cup).toBe(true);
      expect(held.winnerName.toLowerCase().replaceAll(' ', '_')).toBe(id);
    }
  }
});
