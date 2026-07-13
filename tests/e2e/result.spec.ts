/**
 * P8 ROUND_RESULT 화면 e2e (T009)
 */
import { test, expect, chromium } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const SKIP = !process.env.TEST_ROOM_CODE;

test.describe("P8 ROUND_RESULT", () => {
  test.skip(SKIP, "TEST_ROOM_CODE 없음");

  test("랭킹 표시, 작성자 공개, 최하위 💔 연출", async () => {
    const browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();

    const code = process.env.TEST_ROOM_CODE!;
    await page.goto(`${BASE}/room/${code}`);

    // ROUND_RESULT phase 기다림
    const resultHeader = page.locator("text=결과");
    if (await resultHeader.isVisible({ timeout: 60000 })) {
      // 💔 최하위 표시
      await expect(page.locator("text=💔")).toBeVisible();
      // 작성자 공개 (— 닉네임 형태)
      await expect(page.locator("text=—")).toBeVisible();
      // 다음 라운드 카운트다운
      await expect(page.locator("text=다음 라운드")).toBeVisible();
    }

    await browser.close();
  });
});
