# Prevent Chrome Cache Creation Globally (All Existing & Future Profiles)

## 1. Investigation Summary & Global Architecture

To prevent Chrome (`157.0.8103.78`) from writing disk cache files not only in existing profiles (`Default`, `Profile 1`, `Profile 2`), **but also in any newly created or non-existent future profiles** (`Profile 3..N`, `Guest Profile`, etc.) across the system, this plan combines **4 machine-wide layers**:

### Layer 1 — Machine-Wide Policy Redirect + Size Starvation (`HKLM:\SOFTWARE\Policies\Google\Chrome`)
- **`DiskCacheDir = "C:\ProgramData\Google\ChromeCacheDisabled"`** (`REG_SZ`): Routes every profile's (`Default`, `Profile 1..N`, and any newly created profile) HTTP `Cache` and `Code Cache` into `C:\ProgramData\Google\ChromeCacheDisabled\<ProfileName>`.
- **`DiskCacheSize = 1`** (`REG_DWORD`): Caps HTTP disk cache at 1 byte globally for all profiles.
- **`ClearBrowsingDataOnExitList\1 = "cached_images_and_files"`** (`REG_SZ`): Clears cached images/files across all profiles whenever Chrome exits.
- Preserves all 6 existing `HKLM:\SOFTWARE\Policies\Google\Chrome` policies (`NetworkPredictionOptions=0`, `HighEfficiencyModeEnabled=1`, `MemorySaverModeSavings=1`, `BackgroundModeEnabled=0`, `MetricsReportingEnabled=0`, `PromotionsEnabled=0`).

### Layer 2 — NTFS Write-Lock on Global `DiskCacheDir` Target
- Create `C:\ProgramData\Google\ChromeCacheDisabled` empty and apply `icacls` write-deny ACL:
  `/deny "*S-1-5-18:(OI)(CI)(W)" /deny "*S-1-5-32-544:(OI)(CI)(W)" /deny "*S-1-5-32-545:(OI)(CI)(W)"`
- Any existing **or future** profile (`Profile 3`, `Profile 99`, `Guest`) attempting to create subfolders or cache files inside `DiskCacheDir` is immediately blocked by Windows NTFS while retaining Read/List access (`RX`).

### Layer 3 — Global Chromium GPU/Shader/Disk Flags Across All Launch Entry Points
Append `--disk-cache-size=1 --media-cache-size=1 --disable-gpu-shader-disk-cache --disable-gpu-program-cache` (preserving existing flags) to:
- `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk`
- `C:\Users\Public\Desktop\Google Chrome.lnk`
- `HKLM:\SOFTWARE\Classes\ChromeHTML\shell\open\command` (`--single-argument %1` preserved last)
- `HKLM:\SOFTWARE\Clients\StartMenuInternet\Google Chrome\shell\open\command`

### Layer 4 — Clear & Write-Lock Existing Local Cache Folders
- Clear and recreate empty directories for:
  - `User Data\GrShaderCache`, `User Data\ShaderCache` (root global shader folders across all profiles)
  - `Cache`, `Code Cache`, `GPUCache`, `DawnGraphiteCache`, `DawnWebGPUCache` inside `Default`, `Profile 1`, and `Profile 2`
- Clear stale `User Data\BrowserMetrics` and `BrowserMetrics-spare.pma`.
- Apply `(OI)(CI)(W)` write-deny ACLs via `icacls` to all those cleared cache directories while leaving `Cookies`, `Login Data`, `Bookmarks`, `Preferences`, `Extensions`, `Local Storage`, `Session Storage`, and `WebStorage` untouched.

**Tradeoffs / Risks**:
- Pages re-fetch static assets and recompile JS/shaders between visits (slightly higher CPU/network activity on repeated visits).

---

## 2. Rule 11 Pre-Modification Backup Plan

Create `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` before any edits:
- Copy `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk`
- Copy `C:\Users\Public\Desktop\Google Chrome.lnk`
- Export `.reg` backups into `files\reg\`:
  - `HKLM\SOFTWARE\Policies\Google\Chrome`
  - `HKLM\SOFTWARE\Classes\ChromeHTML\shell\open\command`
  - `HKLM\SOFTWARE\Clients\StartMenuInternet\Google Chrome\shell\open\command`
- Verify every backed-up file exists and is > 0 bytes before proceeding.

---

## 3. Execution Steps (After Explicit User Approval)

1. Run Rule 11 pre-modification backups and verify non-zero file sizes.
2. Confirm no `chrome.exe` processes are running.
3. Create & NTFS write-lock `C:\ProgramData\Google\ChromeCacheDisabled`.
4. Clear and NTFS write-lock `User Data\GrShaderCache`, `ShaderCache`, and per-profile (`Default`, `Profile 1`, `Profile 2`) `Cache`, `Code Cache`, `GPUCache`, `DawnGraphiteCache`, `DawnWebGPUCache`; remove stale `BrowserMetrics*`.
5. Set `DiskCacheDir`, `DiskCacheSize`, and `ClearBrowsingDataOnExitList` under `HKLM:\SOFTWARE\Policies\Google\Chrome`.
6. Update both `.lnk` shortcuts and both HKLM shell open commands with `--disk-cache-size=1 --media-cache-size=1 --disable-gpu-shader-disk-cache --disable-gpu-program-cache`.
7. Execute Rule 3 verification (including a live headless Chrome run testing both `Default` **and** a brand-new non-existent profile `"Profile_Future_Test"`), clean up the temporary test profile, and archive `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` per Rule 11.

---

## 4. Verification Plan (Rule 3)

| Target / Dependent Area | Expected State | Verification Method |
|---|---|---|
| Global Chrome Policies | `DiskCacheDir="C:\ProgramData\Google\ChromeCacheDisabled"`, `DiskCacheSize=1`, `ClearBrowsingDataOnExitList\1="cached_images_and_files"`, plus all 6 pre-existing policies intact | `Get-ItemProperty` on `Policies\Google\Chrome` |
| Shortcuts & Shell Commands | All 4 launch targets include all 4 cache-disable flags with original flags preserved | `WScript.Shell` shortcut readback + `Get-ItemProperty` |
| Global `ChromeCacheDisabled` + Existing Cache Dirs | Empty (`0` files) and write-probe denied | `Get-ChildItem -Recurse -File` count = `0` + write probe failure |
| Brand-New Future Profile Test (Non-Existent Before Test) | Launching Chrome with `--profile-directory="Profile_Future_Test"` writes `0` files into `ChromeCacheDisabled` and `0` HTTP/Code/GPU shader cache files into the new profile, without crashing | Headless `chrome.exe` test -> inspect file tree + delete temporary `Profile_Future_Test` |
| Existing Profile Stability | `Default` launches cleanly without crashes, writes `0` cache files, and retains `Bookmarks`, `Cookies`, `Login Data`, `Preferences` | Headless `chrome.exe` test on `Default` + file checks |
| Rule 11 backup & log integrity | Pre-modification backups + archived logs exist and are > 0 bytes | `Get-ChildItem` size check |
