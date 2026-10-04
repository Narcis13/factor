import { ARENA, MATCH_RULES, STARTER_DECK } from '@factor/content';
import { layoutScreen } from '@factor/client';
import { expect, test } from 'vitest';
import { CLIENT_VIEWPORT, pageErrors, waitForReady, withClient } from '../src/browser.ts';
import { playtestTaps } from '../src/playtest.ts';

// End to end in headless Chromium, in real time (~30 s): the deck builder, Battle, a live match where
// side 0's taps become units, and the heuristic bot answering. Needs Chromium, like the shots test.
test('a player builds a deck, battles, and their taps and the bot both put units on the field', { timeout: 120_000 }, async () => {
  await withClient(async (url, browser) => {
    const context = await browser.newContext({ viewport: CLIENT_VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = pageErrors(page);
    await page.goto(url);
    await waitForReady(page, 'the deck builder', errors);

    // A fresh browser starts from the starter deck: all sixteen cards shown, its eight picked.
    expect(await page.locator('.card').count()).toBe(16);
    expect(await page.locator('.card.in').count()).toBe(MATCH_RULES.deckSize);
    const battle = page.locator('[data-action="battle"]');
    await page.click('[data-card="bastion"]');
    expect(await page.locator('.card.in').count()).toBe(MATCH_RULES.deckSize - 1);
    expect(await battle.isDisabled()).toBe(true);
    await page.click('[data-card="hive"]');
    expect(await battle.isDisabled()).toBe(false);
    await battle.click();

    await page.waitForURL(/\?play&seed=\d+$/);
    await waitForReady(page, 'the match', errors);
    // Page-side code goes in as strings: the tools have no DOM types.
    const kept = await page.evaluate<string | null>("window.localStorage.getItem('factor.deck')");
    expect(JSON.parse(kept ?? '[]')).toEqual([...STARTER_DECK.filter((card) => card !== 'bastion'), 'hive']);

    // Side 0 taps a card, then a spot on its own half, every 3 s.
    const layout = layoutScreen(ARENA, MATCH_RULES.handSize, CLIENT_VIEWPORT.width, CLIENT_VIEWPORT.height);
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(3000);
      const [card, spot] = playtestTaps(layout, ARENA, i);
      await page.mouse.click(card.x, card.y);
      await page.mouse.click(spot.x, spot.y);
    }
    // A tapped play goes in on the next tick, so wait for all five rather than read them at once.
    await page.waitForFunction('Number(document.documentElement.dataset.plays0) >= 5', null, { timeout: 15_000 });
    await page.waitForFunction('Number(document.documentElement.dataset.units0) > 0', null, { timeout: 15_000 });
    await page.waitForFunction('Number(document.documentElement.dataset.units1) > 0', null, { timeout: 30_000 });
    const fact = async (name: string) => page.getAttribute('html', `data-${name}`);
    // Under load the loop falls behind real time on purpose (at most 5 ticks a frame), so only check it moved on.
    expect(Number(await fact('tick'))).toBeGreaterThan(100);
    expect(await fact('result')).toBe('none');
    expect(errors).toEqual([]);
    await context.close();
  });
});
