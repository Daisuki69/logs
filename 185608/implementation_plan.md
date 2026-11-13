# Implementation Plan: Fix `edge.exe` Server Communication Under Watchdog

## 1. Root Cause Analysis (Observed Live State)

Runtime diagnostics confirmed why `C:\ddudduddu\edge.exe` works when launched manually as `Admin` (`SessionId = 1`) yet fails to talk to `myserver` when launched by the Scheduled Task `\Edge` (`NT AUTHORITY\SYSTEM`):

1. **Session 0 Isolation (`SYSTEM` Session 0 vs Interactive Desktop Session 1):**
   - `C:\ddudduddu\edge.exe` is a 64-bit Windows GUI (`PE Subsystem = 2`) Python 3.14 (`Nuitka` onefile) executable loading `USER32.dll`, `GDI32.dll`, `SHELL32.dll`, `_ctypes.pyd`, `_wmi.pyd`, `_socket.pyd`, and `_ssl.pyd`.
   - Under Task `\Edge` (`UserId = S-1-5-18` / `SYSTEM`, `LogonType = ServiceAccount`), `edge_watchdog.vbs` runs inside **Session 0** (`Service-0x0-3e7$\Default`) and spawns `edge.exe` inside Session 0 as `SYSTEM` (evidenced by `C:\Windows\Temp\onefile_5292_716249__BVno3pjXJ4` staying alive without connecting).
   - In Session 0, Windows blocks access to the interactive desktop (`WinSta0\Default` in Session 1), and `%USERPROFILE%`, `%TEMP%`, `%USERNAME%`, and `HKCU` resolve to the non-interactive `SYSTEM` profile (`C:\Windows\System32\config\systemprofile`) rather than the logged-in user (`DESKTOP-NUEI506\Admin`).
2. **Missing Working Directory:**
   - Task `\Edge` (`<Exec>`) has a blank `WorkingDirectory` and `edge_watchdog.vbs` does not set `sh.CurrentDirectory = "C:\ddudduddu"`, causing `SYSTEM`-launched processes to start in `C:\Windows\System32` instead of `C:\ddudduddu`.
3. **Why Not Simply Downgrade Task `\Edge` to `Admin`:**
   - Since you plan to remove administrator rights from `Admin`, downgrading `\Edge` itself to a Standard User would allow a Standard User to stop/delete the task or kill the watchdog.
   - Keeping the supervisor/task as **`NT AUTHORITY\SYSTEM`**, while having it bridge Session 0 to launch `edge.exe` directly inside the active user's interactive desktop session (`WinSta0\Default` + user environment + `WorkingDirectory = C:\ddudduddu`), preserves both **server functionality** and **tamper/kill persistence** after `Admin` becomes a Standard User.

---

## 2. Affected Files & Components

| Target | Action | Purpose / Dependency |
| :--- | :--- | :--- |
| `C:\ddudduddu\edge.exe` | **Untouched** | Launched cleanly in active interactive session (`SessionId > 0`) as logged-in user with `lpCurrentDirectory = C:\ddudduddu`. |
| `C:\ddudduddu\edge_watchdog.ps1` | **Create (Zero comments)** | Resident `SYSTEM` watchdog replacing WMI polling with low-overhead `.NET` `[System.Diagnostics.Process]::GetProcessesByName('edge')` (`SessionId > 0` check) and Win32 `WTSQueryUserToken` -> `DuplicateTokenEx` -> `CreateEnvironmentBlock` -> `CreateProcessAsUserW` targeting `"winsta0\\default"` and `"C:\ddudduddu"`. |
| `C:\ddudduddu\edge_watchdog.vbs` | **Back up & Remove** | Replaced by `C:\ddudduddu\edge_watchdog.ps1`. |
| `C:\Windows\System32\Tasks\Edge` (`\Edge`) | **Back up & Update Action** | Keep `S-1-5-18` (`SYSTEM`), `HighestAvailable`, `BootTrigger`, `LogonTrigger`, `PT1M` repetition, `RestartOnFailure`, `IgnoreNew`, `Hidden`. Update Action to run `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ddudduddu\edge_watchdog.ps1"` with `WorkingDirectory = C:\ddudduddu`. |

### Performance & Optimization Rationale
- Eliminates WMI `ExecQuery("SELECT ProcessId FROM Win32_Process ...")` polling every 3 seconds (which repeatedly invokes `WmiPrvSE.exe`), replacing it with a direct in-process `.NET` process check (`2000 ms` interval) that inspects `MainModule.FileName` and `SessionId > 0` only on matching `edge` processes.
- Compiles the Win32 `WTS`/`CreateProcessAsUserW` C# helper once per watchdog startup (`Add-Type`) and strictly releases handles/environment memory in `finally` blocks.
- Handles pre-logon boot cleanly: while no user session is active (`WTSQueryUserToken` fails at logon screen), the `SYSTEM` watchdog waits cleanly and spawns `edge.exe` as soon as the user session becomes active (`<= 2s`).

---

## 3. Pre-Modification Backup Plan (Rule 11)

Before editing or deleting any live system/task file:
1. Create `C:\AI Logs\2026-11-12\<TIMESTAMP>\files\`.
2. Copy untouched originals preserving relative structure and verifying non-zero size:
   - `C:\Windows\System32\Tasks\Edge`
   - `C:\ddudduddu\edge_watchdog.vbs`
   - Export current `\Edge` XML (`schtasks /query /tn "Edge" /xml`) and `icacls C:\ddudduddu /save ...` snapshot for rollback safety.

---

## 4. Verification Plan (Rule 3)

After implementation:
1. **Task & Principal Integrity:** Confirm `Get-ScheduledTask -TaskName 'Edge'` reports `State = Running`, `Principal.UserId = SYSTEM`, `RunLevel = Highest`, `WorkingDirectory = C:\ddudduddu`, and all triggers (`BootTrigger`, `LogonTrigger`, `PT1M` repetition) remain enabled.
2. **ACLs / Standard-User Lock Verification:** Run `icacls` on `C:\ddudduddu`, `C:\ddudduddu\edge.exe`, and `C:\ddudduddu\edge_watchdog.ps1` to confirm `BUILTIN\Users` has only `(RX)` (Read & Execute) while `BUILTIN\Administrators` and `NT AUTHORITY\SYSTEM` hold `(F)` and ownership is `BUILTIN\Administrators`.
3. **Interactive Session Auto-Launch Test:** Stop the manual `edge.exe` test process cleanly, trigger/verify the `SYSTEM` watchdog (`powershell.exe` in `SessionId = 0`), and verify `edge.exe` automatically starts inside **`SessionId = 1`** under **`DESKTOP-NUEI506\Admin`** (visible via `Win32_Process` / `GetOwner`, no Session 0 instance left behind).
4. **Kill-Recovery Persistence Test:** Terminate the watchdog-spawned `edge.exe` (`PID`) and verify the `SYSTEM` supervisor automatically respawns a healthy `edge.exe` in `SessionId = 1` within seconds without manual action or visible console windows.
5. **Server Communication Check (User Confirmation):** Observe DNS/TCP activity where visible from OS tools and request your confirmation that `edge.exe` spawned by `\Edge` communicates with `myserver` identically to manual execution.
6. **Rule 11 Post-Implementation Archival:** Copy final `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` into `C:\AI Logs\2026-11-12\<TIMESTAMP>\` and verify non-zero file sizes.
