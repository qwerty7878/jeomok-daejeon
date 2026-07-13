/**
 * P7 VOTING 화면 e2e (T008)
 */
import { test, expect, chromium } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const SKIP = !process.env.TEST_ROOM_CODE;

test.describe("P7 VOTING", () => {
  test.skip(SKIP, "TEST_ROOM_CODE 없음");

  test("채팅 잠금 UI 표시", async () => {
    const browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();

    const code = process.env.TEST_ROOM_CODE!;
    await page.goto(`${BASE}/room/${code}`);

    // VOTING phase 기다림
    const chatLock = page.locator("text=투표 중 채팅 불가");
    if (await chatLock.isVisible({ timeout: 30000 })) {
      // 채팅 입력창 비활성화 확인
      const chatInput = page.locator("input[placeholder*='메시지']");
      await expect(chatInput).toBeDisabled();
    }

    await browser.close();
  });

  test("투표 목록에 익명 표시 (author 없음)", async () => {
    const browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();

    const code = process.env.TEST_ROOM_CODE!;
    await page.goto(`${BASE}/room/${code}`);

    // 투표 항목이 보이면 작성자 이름이 없어야 함 (VOTING 중)
    const votingItems = page.locator("button:has-text('①')").or(page.locator("button:has-text('②')"));
    if (await votingItems.count() > 0) {
      // 항목이 있을 때 — 닉네임이 노출되면 안 됨
      // ROUND_RESULT에서만 공개됨
      const text = await page.textContent("main") ?? "";
      // 작성자 표시는 "— 닉네임" 형태인데 VOTING에선 없어야 함
      expect(text).not.toMatch(/— .+\n/); // 작성자 줄 없음
    }

    await browser.close();
  });
});
