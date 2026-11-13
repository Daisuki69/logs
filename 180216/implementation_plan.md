# Edge Leftover Removal & Google Chrome Auto-Update Nuke Plan

## 1. Investigation Summary & Scope

### A. Remaining Microsoft Edge / EdgeWebView / EdgeUpdate Artifacts on `C:`
Microsoft Edge browser (`C:\Program Files (x86)\Microsoft\Edge`) is already absent on this system. Only the following leftover files, empty directories, and registry entries exist:
- `C:\Program Files (x86)\Microsoft\EdgeWebView` (`Temp\source1596_1499818134\MSEDGE.7z` — **703.64 MB** staging payload; no `Application` folder)
- `C:\Program Files (x86)\Microsoft\EdgeCore` (`157.0.4341.46\` — empty subdirectory skeleton, **0 files**)
- `C:\Program Files (x86)\Microsoft\Temp` (empty directory, **0 files**)
- `C:\ProgramData\Microsoft\EdgeUpdate` (`Log\MicrosoftEdgeUpdate.log` — **0.39 MB**)
- Registry entries:
  - `HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate`
  - `HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft EdgeWebView` (`100.0.1185.36`, empty `InstallLocation` and `UninstallString`)

**Explicit Safety Exclusions (Untouched)**:
- Scheduled Task `\Edge` (`C:\Windows\System32\Tasks\Edge`) launches **`C:\ddudduddu\edge.exe`** (`PID 2480` / `1660`), which is your local executable in `C:\ddudduddu`, **not** Microsoft Edge. Both `\Edge` and `C:\ddudduddu\edge.exe` will remain untouched.
- Inbox Windows UWP host `C:\Windows\SystemApps\Microsoft.Win32WebViewHost_cw5n1h2txyewy` will remain untouched so core Windows UI dialogs are not impacted.
- Windows `UserChoice` defaults (currently orphaned on `MSEdgeHTM`/`MSEdgePDF`) cannot be programmatically rewritten cleanly due to Windows `UserChoice` hashes; Chrome can be set as Default Browser in Windows Settings -> Default Apps afterward.

---

### B. Google Chrome Update & Auto-Update Nuke Targets
Google Chrome (`157.0.8103.78`, `C:\Program Files\Google\Chrome\Application`) and existing `Policies\Google\Chrome` preferences will stay completely intact. The following update components will be removed and blocked:
1. **Windows Services**:
   - `GoogleUpdaterService157.0.8089.0` (`StartType: Automatic`)
   - `GoogleUpdaterInternalService157.0.8089.0` (`StartType: Automatic`)
   *(Preserves `GoogleChromeElevationService`.)*
2. **Scheduled Tasks**:
   - `\GoogleSystem\GoogleUpdater\GoogleUpdaterTaskSystem157.0.8089.0{32B187B7-B33A-41D2-9D9E-A392C68CB62E}`
   - Task directories `C:\Windows\System32\Tasks\GoogleSystem` and empty `C:\Windows\System32\Tasks\GoogleUserPEH`
3. **Updater Binaries & Anti-Regeneration Folder Lock**:
   - Delete contents of `C:\Program Files (x86)\Google\GoogleUpdater` (`updater.exe`, `uninstall.cmd`, `crx_cache`, logs) and `C:\Program Files (x86)\Google\Update` (`GoogleUpdate.exe`)
   - Recreate empty locked folders at `C:\Program Files (x86)\Google\GoogleUpdater`, `C:\Program Files (x86)\Google\Update`, and `C:\Users\Admin\AppData\Local\Google\GoogleUpdater` with inheritance disabled and `Deny FullControl` ACLs for `SYSTEM`, `Administrators`, and `Users` so Chrome cannot regenerate `updater.exe`.
4. **Enterprise Update Policy Registry Keys**:
   Write the following `REG_DWORD` values under **both** `HKLM:\SOFTWARE\Policies\Google\Update` and `HKLM:\SOFTWARE\WOW6432Node\Policies\Google\Update`:
   - `AutoUpdateCheckPeriodMinutes = 0`
   - `UpdateDefault = 0`
   - `Update{8A69D345-D564-463C-AFF1-A69D9E530F96} = 0` (Chrome App ID update disable)
   - `DisableAutoUpdateChecksCheckboxValue = 1`
   - **Preserve existing** `HKLM:\SOFTWARE\Policies\Google\Chrome` values (`NetworkPredictionOptions=0`, `HighEfficiencyModeEnabled=1`, `MemorySaverModeSavings=1`, `BackgroundModeEnabled=0`, `MetricsReportingEnabled=0`, `PromotionsEnabled=0`).

**Risks / Side Effects**:
- Opening `chrome://settings/help` in Chrome will intentionally report an update check failure / disabled by administrator policy.
- ACL-locked `GoogleUpdater`/`Update` folders will prevent Chrome from self-updating until ACLs and policy keys are reverted.

---

## 2. Rule 11 Pre-Modification Backup Plan

Create `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` before modifying any file or registry key:
- Copy Scheduled Task XML `C:\Windows\System32\Tasks\GoogleSystem\GoogleUpdater\GoogleUpdaterTaskSystem157.0.8089.0{32B187B7-B33A-41D2-9D9E-A392C68CB62E}`
- Copy `C:\Program Files (x86)\Google\GoogleUpdater\prefs.json` and `157.0.8089.0\uninstall.cmd`
- Copy `C:\ProgramData\Microsoft\EdgeUpdate\Log\MicrosoftEdgeUpdate.log`
- Export `.reg` backups into `files\reg\`:
  - `HKLM\SOFTWARE\Policies\Google`
  - `HKLM\SOFTWARE\WOW6432Node\Google\Update`
  - `HKCU\SOFTWARE\Google\Update`
  - `HKLM\SYSTEM\CurrentControlSet\Services\GoogleUpdaterService157.0.8089.0`
  - `HKLM\SYSTEM\CurrentControlSet\Services\GoogleUpdaterInternalService157.0.8089.0`
  - `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate`
  - `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft EdgeWebView`
  *(Note: The `703.64 MB` `MSEDGE.7z` installer archive is excluded from copying into `C:\AI Logs` so 700 MB is not duplicated on `C:`.)*
- Verify all backed-up files/exports are non-zero before continuing.

---

## 3. Execution Steps (After Explicit User Approval)

1. Run Rule 11 pre-modification backups and verify non-zero file sizes.
2. Delete Edge leftovers (`C:\Program Files (x86)\Microsoft\EdgeWebView`, `EdgeCore`, `Temp`, `C:\ProgramData\Microsoft\EdgeUpdate`, and if `C:\Program Files (x86)\Microsoft` becomes empty, remove it) plus `HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate` and `...\Uninstall\Microsoft EdgeWebView`.
3. Stop & delete services `GoogleUpdaterService157.0.8089.0` and `GoogleUpdaterInternalService157.0.8089.0` (`sc.exe stop`, `sc.exe delete`).
4. Unregister `\GoogleSystem\GoogleUpdater\GoogleUpdaterTaskSystem157.0.8089.0{32B187B7-B33A-41D2-9D9E-A392C68CB62E}` and remove `C:\Windows\System32\Tasks\GoogleSystem` & empty `GoogleUserPEH`.
5. Delete `C:\Program Files (x86)\Google\GoogleUpdater` & `C:\Program Files (x86)\Google\Update`, recreate empty directories at those paths plus `C:\Users\Admin\AppData\Local\Google\GoogleUpdater`, and apply `icacls` explicit inheritance-disabled `Deny` ACLs (`SYSTEM`, `Administrators`, `Users`).
6. Apply `Policies\Google\Update` DWORDs in both 64-bit and `WOW6432Node` hives while verifying all 6 existing `Policies\Google\Chrome` settings remain intact.
7. Run verification suite and archive `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` per Rule 11.

---

## 4. Verification Plan (Rule 3 — Dependents, Callers & Critical Flows)

| Target / Dependent Area | Expected State | Verification Method |
|---|---|---|
| Edge leftovers on `C:` | `EdgeWebView`, `EdgeCore`, `Microsoft\Temp`, `ProgramData\Microsoft\EdgeUpdate`, `EdgeUpdate` & `Uninstall\Microsoft EdgeWebView` keys do not exist (`False`) | `Test-Path` checks |
| Protected exclusions | `C:\ddudduddu\edge.exe` still running (`PID 2480`/`1660`), `\Edge` task exists, `Microsoft.Win32WebViewHost_cw5n1h2txyewy` exists | `Get-Process`, `Get-ScheduledTask`, `Test-Path` |
| Google Updater services & task | `sc.exe query` returns `OpenService FAILED 1060` for both `GoogleUpdaterService*` & `GoogleUpdaterInternalService*`; `\GoogleSystem\*` task returns null; `GoogleChromeElevationService` still exists | `sc.exe query`, `Get-ScheduledTask`, `Get-Service` |
| ACL-locked updater folders | Empty folders exist; creating a test file inside fails with access denied (`UnauthorizedAccessException`) | Write probe inside `GoogleUpdater` & `Update` |
| Google Update policies & Chrome intact | Both 64-bit & `WOW6432Node` `Policies\Google\Update` contain all 4 DWORDs (`0`/`0`/`0`/`1`); all 6 existing `Policies\Google\Chrome` values preserved; `chrome.exe` (`157.0.8103.78`) intact; `chrome://settings/help` fails update check | `Get-ItemProperty` audit + Chrome binary check |
| Rule 11 backup & log integrity | Pre-modification backups + `.reg` exports + archived `implementation_plan.md`, `transcript.jsonl`, `transcript_full_snippet.jsonl` exist and are > 0 bytes | `Get-ChildItem` size verification |
