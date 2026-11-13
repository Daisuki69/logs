# Implementation Plan: Fix Unrendered Korean Unicode Characters (Hexboxes / Tofu)

## 1. Investigation & Research Summary
- **Exact Unrendered Glyphs Identified from Screenshots:**
  - `C0AC B791 D574 AE30 C5B5 D574` (`사랑해 기억해`) and `C544 C774 C624 C544 C774` (`아이오아이 I.O.I`)
  - `C5F0 C560 C758 C870 AC74` (`연애의 조건`)
  - All are Korean Hangul syllables (`U+AC00`–`U+D7AF`).
- **System & Browser Inspection:**
  - `C:\Windows\Fonts`, `%LOCALAPPDATA%\Microsoft\Windows\Fonts`, `C:\Windows\WinSxS`, and `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` contain **no** Korean fonts (`Malgun Gothic`, `Gulim`, `Batang`, `Dotum`, `Gungsuh`, or `Noto Sans KR`), and `Language.Fonts.Kore~~~und-KORE~0.0.1.0` is `NotPresent` on this Windows 11 22H2 build (`NoAutoUpdate = 1`).
  - Firefox `159.0.1` (`prefs.js` ETP = `"standard"`, `resistFingerprinting` off, `ContentSandboxLevel = 9` Win32k lockdown) natively maps Korean sans-serif fallback in `omni.ja!greprefs.js` via:
    `pref("font.name-list.sans-serif.ko", "Malgun Gothic, Gulim, Noto Sans CJK KR, Noto Sans KR");`
  - `chrome\user-content.css` sets standard Latin stacks (`"Roboto", sans-serif, ...`) without blocking CJK glyph fallback.
  - Because Firefox Win32k lockdown relies on system-registered fonts in `C:\Windows\Fonts` (`HKLM`), and `HKLM:\...\FontLink\SystemLink` (`Segoe UI`) references stripped Windows fonts (`MALGUN.TTF`, `GULIM.TTC`), any system-wide Korean font must be installed into `C:\Windows\Fonts` (`HKLM`), not just `%LOCALAPPDATA%`.
- **Efficiency & Quality Comparison (`Noto Sans KR` SubsetOTF vs `Language.Fonts.Kore`):**
  - Windows FOD `Language.Fonts.Kore~~~und-KORE~0.0.1.0` adds only legacy pre-Vista fonts (`Batang, Dotum, Gulim, Gungsuh` — ~29.8 MB installed, excluding modern `Malgun Gothic` on stripped builds) and depends on `wuauserv` / Windows Update.
  - Installing official Google/Adobe **`Noto Sans KR` static SubsetOTF** weights (`Regular`, `Medium`, `Bold` from `notofonts/noto-cjk` `Sans/SubsetOTF/KR`, ~13.5 MB total) matches Firefox's built-in `font.name-list.sans-serif.ko` (`"Noto Sans KR"`), matches YouTube Music's `Roboto` 400/500/700 weights cleanly without Thin-default variable-font issues, avoids touching Windows Update policies, and works offline/permanently once installed.

## 2. Proposed Changes
1. **Pre-Modification System Backup (Rule 11):**
   - Create `C:\AI Logs\2026-11-11\<TIMESTAMP>\files\`.
   - Export `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` (`fonts_reg.bak.reg`) and `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontLink\SystemLink` (`systemlink_reg.bak.reg`) into `files\`, verifying both backup files exist and are non-zero before touching registry or `C:\Windows\Fonts`.
2. **Download & System-Wide Install of Official `Noto Sans KR` (`Regular`, `Medium`, `Bold`):**
   - Download official `Sans/SubsetOTF/KR` files (`NotoSansKR-Regular.otf`, `NotoSansKR-Medium.otf`, `NotoSansKR-Bold.otf`) from `https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/` into temporary scratch, verify non-zero expected sizes and OpenType `OTTO` magic header.
   - Install into `C:\Windows\Fonts\` with proper permissions (`TrustedInstaller`/system readability matching existing fonts), register in `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`:
     - `Noto Sans KR Regular (OpenType)` -> `NotoSansKR-Regular.otf`
     - `Noto Sans KR Medium (OpenType)` -> `NotoSansKR-Medium.otf`
     - `Noto Sans KR Bold (OpenType)` -> `NotoSansKR-Bold.otf`
   - Register in live Win32 session via `AddFontResourceW` + `SendMessageTimeout(HWND_BROADCAST, WM_FONTCHANGE)`.
3. **Link `Segoe UI` Fallback in `FontLink\SystemLink`:**
   - Append `NotoSansKR-Regular.otf,Noto Sans KR` cleanly (idempotent check to prevent duplicates) to `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontLink\SystemLink` `'Segoe UI'` so Windows UI, Notepad, Explorer, and tab titles using `Segoe UI` also resolve Hangul glyphs cleanly.

## 3. Affected Components, Callers & Risks
- **Modified OS Paths / Registry Keys:**
  - `C:\Windows\Fonts\NotoSansKR-{Regular,Medium,Bold}.otf`
  - `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`
  - `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontLink\SystemLink` (`Segoe UI`)
- **Dependents / Callers:**
  - DirectWrite & GDI consumers: Firefox `159.0.1` (`Win32k` sandboxed content processes using `font.name-list.sans-serif.ko` + Chrome XUL UI tabs/tooltips), YouTube Music (`Roboto`, `sans-serif`), Google Search, Chrome, Notepad, File Explorer.
- **Risks & Mitigations:**
  - *Corrupt download or partial install:* Verify `OTTO` header + exact byte counts (>4 MB each) before copying to `C:\Windows\Fonts`.
  - *Permission mismatch in `C:\Windows\Fonts` blocking sandboxed Firefox reads:* Verify ACLs allow `Users` / `ALL APPLICATION PACKAGES` Read & Execute (standard inherited ACLs on `C:\Windows\Fonts`) and test live in a Win32k-locked Firefox `159.0.1` process.
  - *GDI `Segoe UI` requiring sign-out/reboot vs immediate DirectWrite effect:* DirectWrite apps (Firefox web pages after restart/new content process) pick up new `HKLM\...\Fonts` entries without reboot; `SystemLink` GDI cache refreshes on next Windows session if an older Win32 app caches fonts.
  - *Reversibility:* Restore `.reg` backups (`reg import`) and delete the 3 `.otf` files from `C:\Windows\Fonts`.

## 4. Device Verification Plan (Rule 3)
1. **Installation & Registry Integrity Check:**
   - Confirm `NotoSansKR-Regular.otf`, `NotoSansKR-Medium.otf`, and `NotoSansKR-Bold.otf` exist in `C:\Windows\Fonts` with `ALL APPLICATION PACKAGES` / `Users` read access and valid entries in `HKLM\...\Fonts` & `SystemLink`.
2. **DirectWrite Glyph Coverage Check:**
   - Query `System.Windows.Media.GlyphTypeface` / `DirectWrite` (`SharpDX` or `PresentationCore` `FontFamily("Noto Sans KR")`) confirming glyphs exist (`TryGetGlyphIndex` succeeds, non-zero glyph IDs) for `사`, `랑`, `해`, `아`, `이`, `오`, `연`, `애`, `의`, `조`, `건`.
3. **Live Firefox Render Verification (Screenshot Inspection via `read_file`):**
   - Launch an isolated test instance (`ff_font_verify`) of `C:\Program Files\Mozilla Firefox\firefox.exe` (keeping your currently open browser session untouched) rendering a local verification HTML page + live YouTube/Search snippet with CSS `"Roboto", Arial, sans-serif` (matching YouTube Music's font stack, at weights `400`, `500`, `700`) containing `"사랑해 기억해 I Love You..."`, `"아이오아이 I.O.I"`, and `"연애의 조건"`.
   - Capture live `PrintWindow` PNG and inspect via `read_file` confirming crisp Korean Hangul glyphs render cleanly at all weights with zero hexboxes/tofu.
4. **Post-Implementation Log Archival (Rule 11):**
   - Archive final `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` into `C:\AI Logs\2026-11-11\<TIMESTAMP>\` and verify non-zero file sizes.
