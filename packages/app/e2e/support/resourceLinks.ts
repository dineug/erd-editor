import { expect, type Page } from '@playwright/test';

/**
 * The empty viewer's Editing Guide and GitHub, each in a new tab, under its
 * buttons: the one row / and /gdrive share, so both runs check it the same way.
 */
export async function expectResourceLinks(page: Page) {
  const buttons = await page
    .getByRole('button', { name: 'Import files', exact: true })
    .boundingBox();
  for (const [name, href] of [
    ['Editing Guide', 'https://docs.erd-editor.io/docs/category/guides'],
    ['GitHub', 'https://github.com/dineug/erd-editor'],
  ]) {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    const box = await link.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(buttons!.y + buttons!.height);
  }
}
