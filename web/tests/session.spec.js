import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const wrongFriction = path.resolve(here, "../../data/test-images/wrong-friction.jpg");

async function openSession(page) {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', wrongFriction);
  await page.getByRole("button", { name: "Start with this page" }).click();
  await expect(page.locator(".session-screen")).toBeVisible();
  await expect(page.locator(".transcript__turn--chintu:not(.transcript__thinking)")).toBeVisible();
}

test("entry and session retain the product hierarchy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "Chat with Chintu" })).toBeVisible();
  await expect(page.locator(".intake-message--chintu")).toContainText("Tell me the question");
  await openSession(page);
  await expect(page.getByText("You are the teacher")).toBeVisible();
  await expect(page.locator(".misconception-card__id")).toHaveText("M-FRIC-04");
  await expect(page.locator('svg[aria-label^="Chintu is"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Talk to Chintu" })).toBeEnabled();
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
});

test("typed reasoning can start without a photo", async ({ page }) => {
  await page.goto("/");
  await page.locator(".intake-sidebar .mic-control__fallback input")
    .fill("I used b over a for the product of roots because b is the coefficient beside x.");
  await page.locator(".intake-sidebar .mic-control__fallback button").click();
  await expect(page.locator(".session-screen")).toBeVisible();
});

test("sidebar voice can start without a photo and releases the stream", async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stopped: false, stop() { this.stopped = true; } };
    window.__ultaIntakeTrack = track;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [track] }) },
    });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(_stream, options = {}) { this.mimeType = options.mimeType || "audio/webm"; this.state = "inactive"; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
        setTimeout(() => this.onstop?.(), 0);
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
  });
  await page.goto("/");
  const button = page.locator(".intake-sidebar .mic-control__button");
  await button.click();
  await expect(page.locator(".intake-sidebar .mic-control")).toHaveClass(/mic-control--recording/);
  await button.click();
  await expect(page.locator(".session-screen")).toBeVisible();
  expect(await page.evaluate(() => window.__ultaIntakeTrack.stopped)).toBe(true);
});

test("one-click voice creates exactly one turn and releases the stream", async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stopped: false, stop() { this.stopped = true; } };
    window.__ultaFakeTrack = track;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [track] }) },
    });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(_stream, options = {}) {
        this.mimeType = options.mimeType || "audio/webm";
        this.state = "inactive";
      }
      start() { this.state = "recording"; }
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
        setTimeout(() => this.onstop?.(), 0);
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
  });

  await openSession(page);
  const button = page.locator(".mic-control__button");
  await button.click();
  await expect(page.locator(".mic-control")).toHaveClass(/mic-control--recording/);
  await expect(button).toContainText("Listening — tap to send");
  await button.click();
  await expect(page.locator(".mic-control")).toHaveClass(/mic-control--idle/);
  await expect(page.locator(".transcript__turn--student")).toHaveCount(1);
  expect(await page.evaluate(() => window.__ultaFakeTrack.stopped)).toBe(true);
});

test("typed fallback completes debate, transfer, and defeat", async ({ page }) => {
  await openSession(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  const input = page.locator(".mic-control__fallback input");

  async function send(text) {
    await input.fill(text);
    await page.locator(".mic-control__fallback button").click();
    await expect(page.locator(".mic-control__button")).toBeEnabled();
  }

  await send("because relative motion");
  await send("The block slips backward relative to the belt at the contact surface.");
  await input.fill("The belt moves forward under the block, so the block slips backward relative to it. Friction acts forward to oppose that contact slipping and accelerates the block.");
  await page.locator(".mic-control__fallback button").click();
  await expect(page.locator(".transfer-card")).toBeVisible();

  await input.fill("The tyre contact tends to slip backward against the road, so friction from the road acts forward.");
  await page.locator(".mic-control__fallback button").click();
  await expect(page.locator(".defeat-screen__headline")).toContainText("M-FRIC-04");
  await expect(page.locator(".defeat-screen__transfer")).toContainText("Transfer verified");
});
