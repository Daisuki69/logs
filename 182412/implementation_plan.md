# Persistent Supervisor & Boot-Resilient Plan for `C:\ddudduddu\edge.exe`

## 1. Investigation Summary & Two-Tier Architecture

Windows Task Scheduler's shortest native repetition/restart interval is **1 minute (`PT1M`)**, and `RestartOnFailure` does not trigger if a process exits cleanly (`0`). To guarantee both **boot reliability** and **immediate automatic restart (~3 seconds) whenever `C:\ddudduddu\edge.exe` is killed or crashes**, this plan pairs a tiny silent VBScript supervisor with a hardened Scheduled Task `\Edge` (`Admin` stored credentials preserved):

### Tier 1 — Silent Process Supervisor (`C:\ddudduddu\edge_watchdog.vbs`)
Launched invisibly via `wscript.exe //B "C:\ddudduddu\edge_watchdog.vbs"`:
- Every `3000 ms`, queries `Win32_Process WHERE ExecutablePath='C:\\ddudduddu\\edge.exe'`.
- If count is `0` (not running / failed boot / crashed / killed), immediately launches `"C:\ddudduddu\edge.exe"`.
- Zero console flash, near-zero idle CPU, and never spawns a duplicate while an instance of `C:\ddudduddu\edge.exe` is already running.

### Tier 2 — Hardened Scheduled Task `\Edge` (`C:\Windows\System32\Tasks\Edge`)
Configured via `Set-ScheduledTask` (omitting `-Principal`/`-User`/`-Password` so existing `Admin` `LogonType: Password` credentials stay intact):
- **Action**: `wscript.exe` with argument `//B "C:\ddudduddu\edge_watchdog.vbs"`
- **Triggers**:
  1. `AtStartup` (`BootTrigger`) — starts supervisor at system boot
  2. `AtLogOn` (`Admin`) — fallback start on user logon if boot start was missed
  3. Indefinite `1-minute` Task Scheduler repetition (`-Once` trigger with `Repetition.Duration = $null`, `StopAtDurationEnd = $false`, `Repetition.Interval = PT1M`) — restarts the supervisor itself within 1 minute if `wscript.exe` is ever killed
- **Resilience Settings**:
  - `StartWhenAvailable = True` (catches up missed boot starts immediately)
  - `RestartCount = 999`, `RestartInterval = PT1M`
  - `AllowStartIfOnBatteries = True`, `DontStopIfGoingOnBatteries = True`
  - `DontStopOnIdleEnd = True`
  - `ExecutionTimeLimit = PT0S` (runs continuously)
  - `MultipleInstances = IgnoreNew` (prevents duplicate watchdog instances)
  - `AllowStartOnDemand = True`, `Hidden = True`

---

## 2. Rule 11 Pre-Modification Backup Plan

Create `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` before any edits:
- Copy `C:\Windows\System32\Tasks\Edge`
- Verify backed-up file exists and matches source byte size (> 0 bytes).

---

## 3. Execution Steps (After Explicit User Approval)

1. Back up `C:\Windows\System32\Tasks\Edge` per Rule 11 and verify non-zero size.
2. Create `C:\ddudduddu\edge_watchdog.vbs` (clean executable VBScript with zero comments).
3. Stop existing duplicate/orphan `edge.exe` test processes cleanly so `\Edge` starts cleanly under the new supervisor without stale unmanaged copies.
4. Update `\Edge` (`-Action`, `-Trigger`, `-Settings` only, keeping `Admin` `Password` principal intact) and run `Start-ScheduledTask -TaskName 'Edge'`.
5. Run live Rule 3 verification (including **killing `C:\ddudduddu\edge.exe` and verifying auto-revival within 5 seconds**), then archive `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` per Rule 11.

---

## 4. Verification Plan (Rule 3)

| Target / Dependent Area | Expected State | Verification Method |
|---|---|---|
| `C:\ddudduddu\edge_watchdog.vbs` | Exists and launches `edge.exe` when count = `0` | `Test-Path` + live test |
| `\Edge` Triggers, Settings & Principal | `AtStartup`, `AtLogOn`, and indefinite `PT1M` triggers active; `StartWhenAvailable=True`, `RestartCount=999`, `StopIfGoingOnBatteries=False`, `MultipleInstances=IgnoreNew`; `Principal` remains `Admin` / `Password` | Inspect `(Get-ScheduledTask 'Edge')` properties & XML |
| Supervisor Start & Duplicate Prevention | `wscript.exe` running `edge_watchdog.vbs` and `C:\ddudduddu\edge.exe` active; calling `Start-ScheduledTask 'Edge'` while running spawns `0` duplicates | `Get-CimInstance Win32_Process` + `Start-ScheduledTask` check |
| Live Kill-and-Restart Auto-Recovery Test | Stopping running `C:\ddudduddu\edge.exe` PIDs causes watchdog to automatically relaunch `C:\ddudduddu\edge.exe` within `<= 5s` | `Stop-Process` on `edge.exe` -> sleep `5s` -> confirm new `edge.exe` PID running |
| Rule 11 backup & log integrity | Pre-modification `Tasks\Edge` backup + archived logs exist and are > 0 bytes | File size check |
