import { expect, test, type Page } from '@playwright/test'

const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect x="15" y="15" width="70" height="70" rx="8"/></svg>`
const circleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="34"/></svg>`

test('demo renders, uploads SVGs, and disposes hit-test SVGs', async ({ page }) => {
  await page.goto('/')
  await page.locator('#glitchRate').fill('0')

  await expect(page.locator('.mask-card')).toHaveCount(1)
  await expect(page.locator('svg[data-pretext-hit-test="true"]')).toHaveCount(1)
  await expectCanvasPainted(page)

  const upload = page.locator('input[data-action="upload"]').first()
  for (const [index, svg] of [squareSvg, circleSvg].entries()) {
    await upload.setInputFiles({
      name: `shape-${index}.svg`,
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(svg),
    })
    await expect(page.locator('svg[data-pretext-hit-test="true"]')).toHaveCount(1)
    await expectCanvasPainted(page)
  }

  await page.locator('#add-mask').click()
  await expect(page.locator('.mask-card')).toHaveCount(2)
  await expect(page.locator('svg[data-pretext-hit-test="true"]')).toHaveCount(2)

  await page.locator('button[data-action="remove"]').first().click()
  await expect(page.locator('.mask-card')).toHaveCount(1)
  await expect(page.locator('svg[data-pretext-hit-test="true"]')).toHaveCount(1)
})

async function expectCanvasPainted(page: Page) {
  await expect
    .poll(async () => {
      return page.locator('canvas.preview').first().evaluate(canvas => {
        const context = canvas.getContext('2d')
        if (!context || canvas.width === 0 || canvas.height === 0) return false

        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        let paintedPixels = 0

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index]
          const green = data[index + 1]
          const blue = data[index + 2]
          const alpha = data[index + 3]

          if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
            paintedPixels += 1
            if (paintedPixels > 32) return true
          }
        }

        return false
      })
    })
    .toBe(true)
}
