# ReNER landing: housing scroll

User-authorized direction, 2026-10-26. Scope: outside landing first, existing functions and backend retained. User asks for the logistics reference's smooth scroll, with housing imagery replacing the ship/train; inner pages will be assessed separately.

## Brief
- Feeling: warm, spacious, calm, clear. References: supplied logistics scroll prompt, yellow paper UI, supplied Stitch homepage (green analytical details).
- Journey: housing scene and clear find-room action → scroll from the place into an annotated rental post → existing real warehouse counts → difficult listing examples → extension preview → data principles → find-room action.
- Energy: quiet arrival, strongest depth movement between scene and evidence, then readable editorial sections.
- Memorable moment: the housing scene recedes while the original post and its separate rent/fees become readable.
- Signature: a window into a leafy Vietnamese residential courtyard, framed by an oversized housing headline and a paper evidence sheet.
- Style: warm photographic editorial, generous space, cream/amber with forest green; no invented testimonials or statistics.
- World: one short pinned housing scene, followed by normal document flow. Native scrolling, no wheel interception or video dependency.
- Assets: supplied screenshots are visual references, not backend contracts. Generate a fictional housing scene; clearly label it as illustrative, not a listed property.

## Feeling curve and scroll score
Arrival: curiosity from cinematic housing and a legible action. First viewport has useful content; do not require a blank screen of scrolling.
Transition: clarity from an independently moving scene and evidence text; transforms and opacity only. Scene slowly pulls back, warm paper enters from below.
Evidence: confidence from the existing labelled post, source quotes, rent and fees displayed separately.
Lower sections: calm, ordinary scrolling and accessible controls.
Peak: “The neighbourhood pulls back, and you can read what the rental price actually means.” No authored dead-scroll pauses.

## Visual tokens and constraints
Cream #f6f4ee; ink #172b25; forest #244b3c; amber #f2cd64; muted #59655b; white #fffdf7.
Existing Be Vietnam Pro for controls/body, Newsreader for large editorial headings, JetBrains Mono for labels/numbers.
Use the existing Next/React/CSS Modules stack. Keep API statistics, dataset propagation, examples, extension states, anchors and listing navigation.
Mobile: shorter motion, separate crop, one-column evidence; reduced motion: static scene and ordinary flow. No information hidden until JS runs.
Verification: production build, existing integration/browser checks, screenshot review at desktop/mobile and multiple scroll positions; scroll reversal, reduced motion and missing API.

## Files and boundaries
New scene: `apps/web/src/features/landing/HousingScene.tsx` and `.module.css`. Generated scene asset: `apps/web/public/images/rener-courtyard.png` (original generated output retained). Updated landing composition: `app/(renter)/page.tsx`, `landing.module.css`, `ReadingHero.tsx` and its CSS. Home-only header colors/layout: `SiteHeader.tsx` and its CSS. Existing header behavior is retained. Browser tests add scroll/reduced-motion coverage and narrow the hero heading selector to level 1.

Snapshots before this change are in `.tmp/pre-cinematic/`. Earlier uncommitted paper-UI restoration changes remain in this isolated clone. No backend change, commit, push or deployment in this step.

## Validation
- TypeScript passed; production build passed. Integration tests: 4/4. Full browser suite: 15/15 (including existing API failures, dataset selection, filters, pagination, evidence, mobile keyboard and 12 route/viewport layout checks).
- Visually inspected actual rendered desktop opening, middle, transition, evidence and lower page; mobile opening and transition. No page errors or horizontal overflow in these captures.
- Added verification of reverse scrolling, anchor landing below header, query preservation to the room finder, static reduced motion, and preference changes while the route is open.
- Pixel sampling of fully covered glyphs against screenshots with text hidden exposed low contrast on sunlit parts of the desktop headline; increased the image overlay before final verification. The ordinary DOM-based AA test alone cannot see a photographic background.
- Browser automation runs on desktop Chromium with mobile viewport emulation. Physical-phone GPU performance and Safari are not verified. Scene is photograph-based parallax, not a generated video.

## Remaining later work
Only the supplied homepage image was visually reviewed for this landing step. ZIP inventory has 7 valid page images and 4 invalid 28-byte image files (pages 2, 8, 9, 11); do not claim all interiors visually assessed. Finish the image-by-image interior review, using KusShoes as the requested implementation reference, before proposing interior changes. No interior UI or new product capability is implemented here.

Final photo-text sample check (390px and 1440px, opening and middle): all pass = True; minimum 4.57:1. Evidence: `.tmp/cinematic-photo-contrast.json` and `.tmp/cinematic-final-*.png`. The pixel sample checks the tested scene states, not every possible browser/device or image position.

## Cloud transition follow-up
The user pointed out that the first delivery omitted the reference's cloud takeover. Added `rener-cloud-bank.png`, a generated photographic cloud asset with verified real alpha (1774×887; alpha range 0–254). Three independent image planes move inward/upward according to the same smoothed scroll position; the scene blends to the existing paper token at the end. Clouds start after the last copy clears the header, with a 0.75-viewport takeover. The next section overlaps 34svh and uses a transparent-to-paper gradient so content rises from the clouds. Motion preference changes remove the clouds and extra scroll runway. Mobile preserves the cloud image aspect ratio.

Files: `HousingScene.tsx`, `HousingScene.module.css`, the cloud asset, one bridge rule in `ReadingHero.module.css`, and browser coverage in `housing-scene.spec.ts`. Backend and product behavior are unchanged. Verified cloud opening/middle/takeover/reversal, desktop and portrait compositions, layout overflow, reduced motion and missing runtime errors. Evidence captures: `.tmp/clouds-final-*.png` and `.tmp/b1-ui-evidence/clouds-*.png`.

Cloud follow-up verification: TypeScript and final production build pass. Four relevant browser checks passed (scroll/dataset, reduced motion, cloud takeover/reversal, 12 route-width layout/AA checks); after the final mobile aspect-ratio adjustment, both cloud and reduced-motion checks passed again (2/2). Final portrait screenshots were viewed at 25%, 50%, 75% takeover; clouds retain natural proportions and the reading section appears through the cream bridge. No physical-device/Safari verification.
