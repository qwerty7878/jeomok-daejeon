/**
 * P6 WRITING 화면 e2e (T007)
 * 로컬 서버 + TEST_ROOM_CODE 필요.
 * CI에서는 TEST_ROOM_CODE 없으면 skip.
 */
import { test, expect, chromium } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const SKIP = !process.env.TEST_ROOM_CODE;

test.describe("P6 WRITING", () => {
  test.skip(SKIP, "TEST_ROOM_CODE 없음");

  test("이미지 표시, 제목 입력, 제출 흐름", async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const code = process.env.TEST_ROOM_CODE!;
    await page.goto(`${BASE}/room/${code}`);

    // 닉네임 입력 (모달이 있으면)
    const nicknameInput = page.locator("input[placeholder*='닉네임']");
    if (await nicknameInput.isVisible()) {
      await nicknameInput.fill("테스터");
      await page.locator("button:has-text('입장')").click();
    }

    // WRITING phase 기다림
    await expect(page.locator("text=WRITING").or(page.locator("text=ROUND"))).toBeVisible({ timeout: 15000 });

    // 이미지 또는 로딩 텍스트
    await expect(
      page.locator("img[alt*='이미지']").or(page.locator("text=이미지 로딩 중"))
    ).toBeVisible({ timeout: 10000 });

    // 타이머 표시
    await expect(page.locator("text=⏱")).toBeVisible();

    // 제목 입력
    const titleInput = page.locator("input[placeholder*='제목']");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("테스트 제목입니다");

    // 제출 버튼
    const submitBtn = page.locator("button:has-text('제출')");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 제출 완료 표시
    await expect(page.locator("text=제출됨").or(page.locator("text=✓"))).toBeVisible({ timeout: 5000 });

    await browser.close();
  });

  test("DevTools 네트워크에 남의 제목이 없다 (C1)", async () => {
    // 이 테스트는 두 개의 탭이 필요 — 6명 e2e에서 검증
    // 여기서는 /state 응답이 submissions 없음을 확인
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const responses: unknown[] = [];
    page.on("response", async (res) => {
      if (res.url().includes("/state")) {
        try {
          const data = await res.json();
          responses.push(data);
        } catch {}
      }
    });

    const code = process.env.TEST_ROOM_CODE!;
    await page.goto(`${BASE}/room/${code}`);
    await page.waitForTimeout(2000);

    // WRITING 중 state 응답에 submissions 없어야 함
    for (const resp of responses) {
      const d = resp as Record<string, unknown>;
      if (d.room && (d.room as Record<string, unknown>).phase === "WRITING") {
        expect(d.submissions).toBeUndefined();
      }
    }

    await browser.close();
  });
});
