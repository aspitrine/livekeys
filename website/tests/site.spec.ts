import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('generated page exposes the project, supported capabilities and sourced comparison', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('Hydration')) errors.push(message.text());
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/LiveKeys/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Votre clavier.*Toutes vos.*scènes/);
  for (const section of ['#possibilites', '#setlists', '#plugins', '#comparaison', '#questions', '#projet']) {
    await expect(page.locator(section)).toBeAttached();
  }
  await expect(page.locator('#comparaison table')).toContainText('AUv3');
  await expect(page.locator('#comparaison')).toContainText('ni enregistrement audio, ni backing tracks, ni timeline');
  await expect(page.locator('#comparaison a[href="https://kymatica.com/apps/aum"]')).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('body')).not.toContainText(/\b(?:import(?:er|ation)?|export(?:er|ation)?)\b/i);
  await expect(page.getByText('Puis-je déplacer mon concert sur un autre iPad ?', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('galleries show genuine app screenshots and link to their full resolution', async ({ page }) => {
  await page.goto('/#possibilites');
  const layers = page.locator('#possibilites');
  const image = layers.getByRole('img');
  await expect(image).toHaveAttribute('src', '/screenshots/layers.png');
  await layers.getByRole('button', { name: 'Afficher la capture : Basse / EP' }).click();
  await expect(image).toHaveAttribute('src', '/screenshots/split.png');
  await expect(image).toHaveAttribute('alt', /basse.*piano électrique/);
  await expect(layers.getByRole('button', { name: 'Afficher la capture : Basse / EP' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const link = layers.getByRole('link', { name: /Voir en grand/ });
  const [fullSize] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await fullSize.waitForLoadState();
  await expect(fullSize).toHaveURL(/screenshots\/split.png$/);
  await fullSize.close();
  const plugins = page.locator('#plugins');
  await plugins.getByRole('button', { name: 'Afficher la capture : Régler un effet' }).click();
  await expect(plugins.getByRole('img')).toHaveAttribute('src', '/screenshots/effect-editor.png');
  await expect(plugins).toContainText('un effet Apple');
  await expect(page.locator('#setlists img')).toHaveAttribute('src', '/screenshots/stage.png');
});

test('every screenshot is available as an original landscape iPad PNG', async ({ request, page }) => {
  for (const file of ['layers', 'split', 'stage', 'effects', 'effect-editor']) {
    const response = await request.get(`/screenshots/${file}.png`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes = await response.body();
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(2064);
    expect(bytes.readUInt32BE(20)).toBe(2752);
  }
  await page.goto('/');
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => (element as HTMLImageElement).decode());
    await expect(image).toHaveJSProperty('naturalWidth', 2752);
    await expect(image).toHaveJSProperty('naturalHeight', 2064);
  }
});

test('mobile navigation works and the page fits narrow screens', async ({ page }) => {
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const title = await page.locator('.hero-title > span').boundingBox();
    expect(title!.x + title!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.locator('.menu-toggle');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('link', { name: 'Plugins AUv3' }).click();
  await expect(page).toHaveURL(/#plugins$/);
  await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toHaveCount(0);
  await expect(page.locator('#plugins')).toBeInViewport();
});

test('FAQ heading separates its words on mobile and keeps its desktop line break', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [360, 390, 720, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#questions');
    const heading = page.locator('#questions h2');
    await expect(heading).toHaveAccessibleName('Quelques repères.');
    const words = await heading.evaluate((element) => {
      const text = element.firstChild!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, text.textContent!.trimEnd().length);
      const first = range.getBoundingClientRect();
      const second = element.querySelector('em')!.getBoundingClientRect();
      return { firstRight: first.right, firstTop: first.top, secondLeft: second.left, secondTop: second.top };
    });
    if (width <= 720) {
      expect(words.secondTop).toBeCloseTo(words.firstTop, 0);
      expect(words.secondLeft - words.firstRight).toBeGreaterThan(2);
    } else {
      expect(words.secondTop - words.firstTop).toBeGreaterThan(20);
    }
  }
});

test('reduced motion leaves the page visible and disables parallax and tilt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.mouse.move(950, 350);
  await page.locator('#plugins').scrollIntoViewIfNeeded();
  const hidden = await page
    .locator('[data-reveal]')
    .evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).opacity !== '1').length);
  expect(hidden).toBe(0);
  expect(await page.locator('[data-tilt]').evaluate((element) => (element as HTMLElement).style.transform)).toBe('');
});

test('static content and native FAQ remain useful with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#comparaison table')).toContainText('MainStage');
  await page.getByText('Ai-je besoin de plugins pour commencer ?', { exact: true }).click();
  await expect(page.getByText(/^Non\. Le piano droit/)).toBeVisible();
  await context.close();
});

test('desktop and mobile content have no serious accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.locator('#possibilites').getByRole('button', { name: 'Afficher la capture : Basse / EP' }).click();
    await page.getByRole('button', { name: 'Afficher la capture : Régler un effet' }).click();
    const toggled = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(toggled.violations).toEqual([]);
  }
});
