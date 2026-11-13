# System Cleanup & Complete Removal Plan

## 1. Investigation Summary & Key Findings

1. **Mozilla Firefox (`159.0.1 x64 en-US`) on `C:`**:
   - Currently **not running**. Native NSIS uninstaller exists at `C:\Program Files\Mozilla Firefox\uninstall\helper.exe` (silent flag `-ms` verified via Mozilla documentation).
   - Directories on `C:` to purge completely:
     - `C:\Program Files\Mozilla Firefox` (90 items, including `autoconfig.cfg`, `defaults\pref\autoconfig.js`, `distribution\policies.json`)
     - `C:\ProgramData\Mozilla-1de4eec8-1241-4177-a864-e594e8d1fb38` (6 items)
     - `C:\Users\Admin\AppData\Roaming\Mozilla` (2,922 items)
     - `C:\Users\Admin\AppData\Local\Mozilla` (12,694 items)
   - Shortcuts on `C:`:
     - `C:\firefox.exe.lnk`
     - `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Firefox.lnk`
     - `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Firefox Private Browsing.lnk`
     - `C:\Users\Admin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Firefox.lnk`
   - Registry entries:
     - `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Mozilla Firefox`
     - `HKLM:\SOFTWARE\Mozilla`, `HKLM:\SOFTWARE\WOW6432Node\Mozilla`, `HKLM:\SOFTWARE\Policies\Mozilla`, `HKCU:\SOFTWARE\Mozilla`
     - `HKLM:\SOFTWARE\Clients\StartMenuInternet\Firefox-308046B0AF4A39CB`, `HKLM:\SOFTWARE\RegisteredApplications` value `Firefox-308046B0AF4A39CB`
     - `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe`
     - `HKLM:\SOFTWARE\Classes\Applications\firefox.exe`
     - `HKLM:\SOFTWARE\Classes\FirefoxHTML-308046B0AF4A39CB`, `FirefoxURL-308046B0AF4A39CB`, `FirefoxPDF-308046B0AF4A39CB`
     - `HKCU:\SOFTWARE\Classes\FirefoxPDF-308046B0AF4A39CB`
     - `HKCU` `MuiCache` & `FeatureUsage\AppSwitched` entries referencing Firefox

2. **MiniTool (`MiniTool Partition Wizard 12.9` traces on `C:`)**:
   - No separate "MiniTool Partition Recovery" install exists on `C:`; instead, orphaned traces of **MiniTool Partition Wizard 12.9** (`InstallLocation: E:\Program Files\MiniTool Partition Wizard 12\`, directory absent on `E:`) remain on `C:`:
     - **Kernel Driver Services & `.sys` Files (Critical)**:
       - `pwdrvio` -> `C:\Windows\System32\pwdrvio.sys` (19,152 bytes, **Running**, Boot start)
       - `pwdspio` -> `C:\Windows\System32\pwdspio.sys` (12,504 bytes, Stopped, Manual start)
       - Storage class `UpperFilters` / `LowerFilters` verified clean (`partmgr` / `EhStorClass` and `volsnap` / `fvevol,iorate,rdyboost`).
     - Start Menu shortcuts: `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\MiniTool Partition Wizard 12\` (`.lnk` & `.url`)
     - Registry entries:
       - `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{05D996FA-ADCB-4D23-BA3C-A7C184A8FAC6}_is1`
       - `HKLM:\SOFTWARE\MiniTool Software Limited`, `HKLM:\SOFTWARE\WOW6432Node\MiniTool Software Limited`, `HKCU:\SOFTWARE\MiniTool Software Limited`
       - `HKCU` `MuiCache`, `AppSwitched`, and `Recent` shortcut `_Getintopc.com_MiniTool_Partition_Wizard_Technician_12.9 (2).rar.lnk`

3. **`C:\msedge.exe` & Scheduled Task `\MSEDGE`**:
   - `C:\msedge.exe` (13,147,050 bytes, unsigned) is currently **running** as `PID 2584` and `PID 3676`, launched at boot by Task Scheduler (`svchost.exe -k netsvcs -p`) via Scheduled Task `\MSEDGE` (`C:\Windows\System32\Tasks\MSEDGE`).
   - Deleting `C:\msedge.exe` requires terminating `PID 2584` / `PID 3676` (which also unlocks its active `_MEI*` / `onefile_*` extraction temp directory) and unregistering Scheduled Task `\MSEDGE` + clearing `MuiCache` / `Recent\msedge.lnk` so Windows does not attempt to launch a missing executable at boot.
   - `C:\ddudduddu\edge.exe` and `C:\Users\Admin\Desktop` / `C:\AI Logs\` will **not** be touched.

4. **Temp Files & Recycle Bin**:
   - Discovered temp/cache volumes:
     - `C:\Users\Admin\AppData\Local\Temp` (~763.23 MB / 1,526 files, including stale `7zS04353166`, `onefile_*`, and `_MEI*` unpack dirs)
     - `C:\Windows\Temp` (~0.22 MB / 19 files)
     - `C:\Windows\SystemTemp` (~0.34 MB / 40 files)
     - `C:\Windows\SoftwareDistribution\Download` (~7.20 MB / 2 files)
     - `C:\Users\Admin\AppData\Local\D3DSCache` (~0.38 MB / 18 files)
     - `C:\Users\Admin\AppData\Local\Microsoft\Windows\INetCache` (~1.25 MB / 16 files)
     - `C:\Windows\Logs` (~7.29 MB / 37 files, optional stale log files that are unlocked)
   - Recycle Bin (`C:\$RECYCLE.BIN`): 9 items (~143.99 MB / 27 raw files), including MiniTool `.rar` and `chrome.exe` `.lnk`.
   - **Protected exclusions (never deleted)**: `C:\AI Logs\`, `C:\Users\Admin\.gemini\`, `C:\Users\Admin\AppData\Local\Google\Chrome\`, `C:\Users\Admin\AppData\Local\StartAllBack\`, `C:\Windows\Prefetch\ReadyBoot`, and any file actively locked by running `Antigravity IDE` or Windows core processes.

---

## 2. Rule 11 Pre-Modification Backup Plan

Create timestamped backup folder `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` **before** deleting or modifying any target:
- Copy `C:\firefox.exe.lnk`
- Copy `C:\Windows\System32\Tasks\MSEDGE`
- Copy `C:\Windows\System32\pwdrvio.sys` and `C:\Windows\System32\pwdspio.sys`
- Copy custom Firefox configuration files (`C:\Program Files\Mozilla Firefox\distribution\policies.json`, `autoconfig.cfg`, `defaults\pref\autoconfig.js`, `C:\Users\Admin\AppData\Roaming\Mozilla\Firefox\Profiles\s22bx8y4.default-release\chrome\custom.css`)
- Export registry trees via `reg export` to `.reg` files inside `files\reg\`:
  - `HKLM\SOFTWARE\Mozilla`, `HKLM\SOFTWARE\Policies\Mozilla`, `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Mozilla Firefox`, `HKLM\SOFTWARE\Clients\StartMenuInternet\Firefox-308046B0AF4A39CB`
  - `HKLM\SOFTWARE\MiniTool Software Limited`, `HKLM\SOFTWARE\WOW6432Node\MiniTool Software Limited`, `HKCU\SOFTWARE\MiniTool Software Limited`, `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{05D996FA-ADCB-4D23-BA3C-A7C184A8FAC6}_is1`
  - `HKLM\SYSTEM\CurrentControlSet\Services\pwdrvio`, `HKLM\SYSTEM\CurrentControlSet\Services\pwdspio`
- Verify all backed-up files/exports exist and have non-zero size before proceeding.

---

## 3. Execution Steps (After Explicit User Approval)

1. **Terminate Locked Processes & Unregister Task `\MSEDGE`**:
   - Stop `C:\msedge.exe` processes (`PID 2584`, `PID 3676`, and any child processes using `ExecutablePath -eq 'C:\msedge.exe'`).
   - Unregister Scheduled Task `\MSEDGE` (`Unregister-ScheduledTask -TaskName 'MSEDGE' -Confirm:$false`).
   - Delete `C:\msedge.exe`, `C:\firefox.exe.lnk`, and `Recent\msedge.lnk`.

2. **Uninstall & Purge All Firefox Traces on `C:`**:
   - Run `"C:\Program Files\Mozilla Firefox\uninstall\helper.exe" -ms` and wait for completion.
   - Delete any residual directories/files in:
     - `C:\Program Files\Mozilla Firefox`
     - `C:\Program Files (x86)\Mozilla Firefox`
     - `C:\ProgramData\Mozilla*`
     - `C:\Users\*\AppData\Roaming\Mozilla`
     - `C:\Users\*\AppData\Local\Mozilla`
     - `C:\Users\*\AppData\LocalLow\Mozilla`
   - Remove all Firefox `.lnk` Start Menu/Desktop shortcuts and `Recent` references.
   - Remove all remaining Firefox registry keys (`SOFTWARE\Mozilla`, `WOW6432Node\Mozilla`, `Policies\Mozilla`, `App Paths\firefox.exe`, `Clients\StartMenuInternet\Firefox-*`, `RegisteredApplications\Firefox-*`, `Classes\Firefox*`, `Classes\Applications\firefox.exe`) and `MuiCache` / `AppSwitched` values matching `firefox`/`mozilla`.

3. **Purge All MiniTool Traces & Drivers on `C:`**:
   - Attempt `sc.exe stop pwdrvio`, `sc.exe stop pwdspio`, then `sc.exe delete pwdrvio` and `sc.exe delete pwdspio` (and delete `HKLM\SYSTEM\CurrentControlSet\Services\pwdrvio` / `pwdspio` if needed).
   - Delete `C:\Windows\System32\pwdspio.sys` and `C:\Windows\System32\pwdrvio.sys`. If `pwdrvio.sys` is kernel-locked while running, register `MoveFileExW(..., NULL, MOVEFILE_DELAY_UNTIL_REBOOT)` via `PendingFileRenameOperations` so Windows removes it cleanly on next reboot.
   - Delete `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\MiniTool Partition Wizard 12`.
   - Remove MiniTool Uninstall key, `MiniTool Software Limited` keys (`HKLM`, `WOW6432Node`, `HKCU`), `MuiCache` / `AppSwitched` values, and `Recent` MiniTool shortcut.

4. **Clean Temp Files & Empty Recycle Bin**:
   - Clear contents of `C:\Users\Admin\AppData\Local\Temp`, `C:\Windows\Temp`, `C:\Windows\SystemTemp`, `C:\Users\Admin\AppData\Local\D3DSCache`, `C:\Users\Admin\AppData\Local\Microsoft\Windows\INetCache`, `C:\Windows\SoftwareDistribution\Download`, and unlocked files in `C:\Windows\Logs` (skipping actively locked IDE/system handles gracefully and reporting exact counts/sizes removed + any locked skips).
   - Empty Recycle Bin via `Clear-RecycleBin -DriveLetter C -Force` (fallback: COM Shell + raw `$RECYCLE.BIN` cleanup if needed) while keeping `C:\AI Logs\` and `.gemini` untouched.

5. **Post-Implementation Log Archival (Rule 11)**:
   - Archive `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` into `C:\AI Logs\<DATE>\<TIMESTAMP>\` and verify non-zero file sizes.

---

## 4. Verification Plan (Rule 3 — Dependents, Callers & Critical Flows)

| Target / Dependent Area | Expected State After Cleanup | Verification Command / Method |
|---|---|---|
| `C:\firefox.exe.lnk`, `C:\msedge.exe`, `Recent` links | File does not exist (`False`); no running `msedge` process from `C:\msedge.exe` | `Test-Path` checks + `Get-Process` |
| Scheduled Task `\MSEDGE` | Unregistered; task XML removed from `C:\Windows\System32\Tasks\MSEDGE` | `Get-ScheduledTask -TaskName 'MSEDGE'` returns null |
| Firefox files, shortcuts & registry | Zero directories under `Program Files*`, `ProgramData\Mozilla*`, `AppData\*\Mozilla`; zero Start Menu `.lnk`; zero `Uninstall`/`Classes`/`Clients`/`Policies`/`MuiCache` keys | Targeted PowerShell path + registry audit script |
| MiniTool files, shortcuts, registry & drivers | Zero `MiniTool` Uninstall/Software/StartMenu/Recent keys; `pwdspio.sys` deleted; `pwdrvio` & `pwdspio` service keys deleted (or `pwdrvio.sys` verified queued in `PendingFileRenameOperations` if kernel-locked until reboot) | `sc.exe query`, `Test-Path`, `Get-ItemProperty` on `Session Manager\PendingFileRenameOperations` |
| Default browser / OS file handlers (dependent flow) | `http`, `https`, `.html`, `.htm`, `.pdf` `UserChoice` remain valid (`MSEdgeHTM`/`MSEdgePDF`) and Chrome installation (`C:\Program Files\Google`) remains intact | Read `UserChoice\ProgId` + check Chrome executable exists |
| Temp caches & Recycle Bin | `%TEMP%`, `Windows\Temp`, `SystemTemp`, `D3DSCache`, `INetCache`, `SoftwareDistribution\Download` cleared (barring locked OS/Antigravity handles); Recycle Bin item count = `0` and raw size = `0` | PowerShell size/file count audit + `(New-Object -Com Shell.Application).NameSpace(10).Items().Count` |
| Rule 11 backup & log integrity | Pre-modification files + registry exports + final `implementation_plan.md`, `transcript.jsonl`, `transcript_full_snippet.jsonl` exist and are > 0 bytes in `C:\AI Logs\<DATE>\<TIMESTAMP>\` | `Get-ChildItem -Recurse` size check |
