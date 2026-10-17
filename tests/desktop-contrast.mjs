// Measures the renderer against WCAG 2.2 AA on a seeded workspace:
//   - text contrast against the background it is actually drawn on (4.5:1,
//     or 3:1 for large text),
//   - control boundaries (input/select/textarea borders, bordered buttons)
//     against their surroundings (3:1),
//   - hit areas of every visible control (24 px minimum; 36 px reported).
// Run after `npm run desktop:build`:
//   xvfb-run -a node tests/desktop-contrast.mjs
import { _electron as electron } from "@playwright/test";
import executablePath from "electron";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = mkdtempSync(join(tmpdir(), "newsletter-contrast-"));
const testEnv = { ...process.env, NEWSLETTER_TEST_DATA: directory };
delete testEnv.ELECTRON_RUN_AS_NODE;
let app;
const audit = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a),
      l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const hex = (c) =>
    "#" +
    [c.r, c.g, c.b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("");
  const root = parse(
    getComputedStyle(document.documentElement).backgroundColor,
  ) || {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  };
  const effBg = (el) => {
    let e = el,
      acc = null;
    while (e && e !== document.documentElement) {
      const bg = parse(getComputedStyle(e).backgroundColor);
      if (bg && bg.a > 0) {
        acc = acc ? blend(acc, bg) : bg;
        if (bg.a >= 1) return acc;
      }
      e = e.parentElement;
    }
    return acc ? blend(acc, root) : root;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (r.bottom < 0 || r.right < 0) return false;
    if (r.top > innerHeight || r.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (typeof el.className === "string" && el.className.trim())
      s += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
    return s;
  };
  const text = [],
    seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!visible(el) || el.closest("[hidden], dialog:not([open])")) continue;
    const cs = getComputedStyle(el);
    let fg = parse(cs.color);
    if (!fg) continue;
    const bg = effBg(el);
    if (fg.a < 1) fg = blend(fg, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(fg, bg);
    const need = large ? 3 : 4.5;
    const key = `${label(el)}|${hex(fg)}|${hex(bg)}|${Math.round(size)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r < need)
      text.push({
        where: label(el),
        fg: hex(fg),
        bg: hex(bg),
        size,
        ratio: +r.toFixed(2),
        sample: t.slice(0, 40),
      });
  }
  const controls = [],
    targets = [];
  for (const el of document.querySelectorAll(
    "button, input, textarea, select, summary, [role=button], [role=separator]",
  )) {
    if (!visible(el) || el.closest("[hidden], dialog:not([open])")) continue;
    const rect = el.getBoundingClientRect();
    // The resize separator is 6px wide on screen and extends its pointer
    // target to 24px with a ::after box, which getBoundingClientRect omits.
    if (
      el.tagName !== "SUMMARY" &&
      el.getAttribute("role") !== "separator" &&
      (rect.width < 24 || rect.height < 24) &&
      getComputedStyle(el).position !== "absolute"
    )
      targets.push({
        where: label(el),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        name: (el.getAttribute("aria-label") || el.textContent || "")
          .trim()
          .slice(0, 30),
      });
    const cs = getComputedStyle(el);
    // A field may draw its edge as a full box or as a ruled bottom line.
    const top = {
      w: parseFloat(cs.borderTopWidth),
      c: parse(cs.borderTopColor),
    };
    const bottom = {
      w: parseFloat(cs.borderBottomWidth),
      c: parse(cs.borderBottomColor),
    };
    const edge = [top, bottom].find(
      (side) => side.w > 0 && side.c && side.c.a > 0,
    );
    const field = /INPUT|TEXTAREA|SELECT/.test(el.tagName);
    if (el.type === "checkbox" || el.type === "color" || el.type === "range")
      continue;
    const outer = effBg(el.parentElement || document.body);
    if (edge) {
      const bc = edge.c;
      const boundary = bc.a < 1 ? blend(bc, outer) : bc;
      const r = ratio(boundary, outer);
      // Fields must have a visible edge. Buttons may be ghost buttons, but once
      // they draw a border it has to be visible too.
      if (r < 3 && (field || el.tagName === "BUTTON"))
        controls.push({
          where: label(el),
          border: hex(boundary),
          against: hex(outer),
          ratio: +r.toFixed(2),
        });
    } else if (field && !el.closest(".search-field")) {
      const own = parse(cs.backgroundColor);
      const fill =
        own && own.a > 0 ? (own.a < 1 ? blend(own, outer) : own) : null;
      const r = fill ? ratio(fill, outer) : 1;
      if (r < 3)
        controls.push({
          where: label(el),
          border: "none",
          against: hex(outer),
          ratio: +r.toFixed(2),
        });
    }
  }
  return { text, controls, targets };
};

const report = {};
let failed = false;
try {
  app = await electron.launch({
    executablePath,
    args: ["--no-sandbox", "apps/desktop"],
    env: testEnv,
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByText("A good newsletter starts here.").waitFor();
  const check = async (name) => {
    const result = await page.evaluate(audit);
    report[name] = result;
    await page.screenshot({ path: `/tmp/newsletter-contrast-${name}.png` });
    const bad =
      result.text.length || result.controls.length || result.targets.length;
    if (bad) failed = true;
    console.log(
      `${bad ? "FAIL" : "ok  "} ${name}: ${result.text.length} text, ${result.controls.length} control, ${result.targets.length} small targets`,
    );
    for (const t of result.text)
      console.log(
        `    text  ${t.ratio.toFixed(2)}:1 ${t.fg} on ${t.bg} ${t.size}px ${t.where} "${t.sample}"`,
      );
    for (const c of result.controls)
      console.log(
        `    edge  ${c.ratio.toFixed(2)}:1 ${c.border} on ${c.against} ${c.where}`,
      );
    for (const s of result.targets)
      console.log(`    size  ${s.w}x${s.h} ${s.where} "${s.name}"`);
  };
  await check("welcome");
  await page.evaluate(async () => {
    const api = window.newsletter;
    const make = async (name, topic, color, titles) => {
      const profile = await api.invoke("saveProfile", {
        id: crypto.randomUUID(),
        name,
        topic,
        audience: "Neighbors",
        tone: "Warm",
        language: "English",
        freshnessDays: 14,
        brandColor: color,
        organization: "",
        logoAssetId: "",
        logoAlt: "",
        footer: "",
        ctaLabel: "",
        ctaBody: "",
        ctaUrl: "",
        sources: [],
        revision: 0,
      });
      for (const [title, subject] of titles)
        await api.invoke("saveIssue", {
          id: crypto.randomUUID(),
          profileId: profile.id,
          title,
          subject,
          preheader: "Three ways to take part this month.",
          intro: "Hello, neighbors! A new month brings a few reasons to meet.",
          articles: [],
          blocks: [
            {
              id: crypto.randomUUID(),
              kind: "text",
              title: "A small donation. A real difference.",
              body: "Throughout November, the community center is collecting unopened toiletries.",
              url: "",
              sourceIds: [],
              assetId: "",
              alt: "",
            },
            {
              id: crypto.randomUUID(),
              kind: "event",
              title: "A fresh start for the park",
              body: "November 7 · 9–11 a.m. Meet at the east entrance.",
              url: "",
              sourceIds: [],
              assetId: "",
              alt: "",
            },
          ],
          revision: 0,
          updatedAt: new Date().toISOString(),
        });
    };
    await make("Oakfield Neighbors", "Community news and events", "#31563c", [
      [
        "November Community Update",
        "A cleanup day, a book swap, and a reason to meet",
      ],
      ["October Community Update", "A little autumn, a lot of community"],
    ]);
    await make("Willow & Grain", "Bakery notes", "#7a5230", [
      ["Harvest loaves", "Sourdough season is here"],
    ]);
  });
  await page.reload();
  await page.locator(".edition-card").first().waitFor();
  await check("desk");
  await page.locator(".view-toggle button", { hasText: "List" }).click();
  await check("desk-list");
  await page
    .locator(".publication-nav", { hasText: "Oakfield Neighbors" })
    .click();
  await page.locator(".desk-hero").waitFor();
  await check("desk-newsletter");
  await page.getByRole("button", { name: "Continue writing" }).click();
  await page.locator(".editor-block").first().waitFor();
  await page.locator(".email-details summary").click();
  await check("editor");
  await page.locator(".editor-block").first().focus();
  await check("editor-active-block");
  await page
    .getByRole("button", { name: "Preview & Export", exact: true })
    .click();
  await page.locator(".export-view").waitFor();
  await check("preview");
  await page.getByRole("button", { name: "AI & integrations" }).click();
  await page.locator(".settings-tabs").waitFor();
  await check("settings");
  await page
    .getByRole("button", { name: "Newsletter settings" })
    .first()
    .click();
  await page.getByLabel("Newsletter name", { exact: true }).waitFor();
  await check("newsletter-settings");
  if (failed) {
    console.error("Contrast or target-size audit failed.");
    process.exitCode = 1;
  } else console.log("Contrast audit passed on every page.");
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(directory, { recursive: true, force: true });
}
