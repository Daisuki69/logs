# Upgrade `C:\ddudduddu\` & `\Edge` to Maximum Privilege (`NT AUTHORITY\SYSTEM`)

## 1. Investigation Summary & Critical Findings

Removing Administrator rights from `Admin` exposes **two gaps** in the current setup:
1. **`\Edge` Principal is currently `Admin` / `LogonType: S4U`**:
   - S4U depends on `SeBatchLogonRight` (typically held by Administrators, often unavailable to demoted Standard Users) and runs in `Admin`'s security context. Once `Admin` loses Admin rights, `\Edge` can fail to start (`0x8007052e` / logon error) or run unprivileged so standard users can kill it.
2. **`C:\ddudduddu\` currently inherits `NT AUTHORITY\Authenticated Users:(I)(M)` (Modify)**:
   - Because `C:\ddudduddu`, `edge.exe`, and `edge_watchdog.vbs` inherit ACLs from `C:\`, even a demoted Standard User can still rename, modify, or delete those files, and could reclaim permissions if listed as Owner.

---

## 2. Proposed Changes (Maximum Privilege & Standard-User Lockout)

1. **Elevate Scheduled Task `\Edge` to `NT AUTHORITY\SYSTEM`**:
   - `Principal`: `-UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest` (absolute highest local OS privilege; runs at `BootTrigger` and continuously in `Session 0` completely independent of `Admin`'s group membership or password).
   - Keep `BootTrigger`, `AtLogOn` (any user, not tied to `Admin`), indefinite `1-minute` repetition (`PT1M`), `StartWhenAvailable=True`, `RestartCount=999`, `DontStopIfGoingOnBatteries=True`, `DontStopOnIdleEnd=True`, `ExecutionTimeLimit=PT0S`, `MultipleInstances=IgnoreNew`, and `Hidden=True`.

2. **Harden NTFS Ownership & ACLs on `C:\ddudduddu`, `edge.exe`, and `edge_watchdog.vbs`**:
   - Set NTFS Owner recursively (`icacls /setowner "*S-1-5-18"`) to **`NT AUTHORITY\SYSTEM`** so a Standard User cannot override permissions via implicit `WRITE_DAC`.
   - Disable inheritance (`/inheritance:r`) and remove `Authenticated Users:(M)` so **only**:
     - `NT AUTHORITY\SYSTEM` (`*S-1-5-18`) -> `(OI)(CI)F` (Full Control)
     - `BUILTIN\Administrators` (`*S-1-5-32-544`) -> `(OI)(CI)F` (Full Control)
     - `BUILTIN\Users` (`*S-1-5-32-545`) -> `(OI)(CI)RX` (Read & Execute only — zero write, delete, rename, or permission-edit rights)

**Tradeoff / Requirement**:
- While `Admin` retains current Admin rights, this change executes cleanly; once you demote `Admin` to Standard User, `Admin` will no longer be able to kill `wscript.exe` / `edge.exe`, edit/delete `\Edge`, or delete/modify files inside `C:\ddudduddu\` (the built-in `Administrator` account or an elevated admin prompt would be required).

---

## 3. Rule 11 Pre-Modification Backup Plan

Create `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` before any edits:
- Copy `C:\Windows\System32\Tasks\Edge`
- Save current `icacls C:\ddudduddu /save ...` ACL snapshot + `edge_watchdog.vbs`
- Verify non-zero backup sizes before applying changes.

---

## 4. Execution Steps (After Explicit User Approval)

1. Save Rule 11 pre-modification backups (`Tasks\Edge`, ACL snapshot, `edge_watchdog.vbs`).
2. Stop existing `\Edge` and `Admin`-owned `wscript.exe` / `edge.exe` instances so they restart cleanly under `NT AUTHORITY\SYSTEM`.
3. Update `\Edge` to `NT AUTHORITY\SYSTEM` (`ServiceAccount`, `Highest`) and register hardened triggers/settings.
4. Apply `/setowner "*S-1-5-18"` and `/inheritance:r` ACL lockdown (`SYSTEM:F`, `Administrators:F`, `Users:RX`) across `C:\ddudduddu`, `edge.exe`, and `edge_watchdog.vbs`.
5. Start `\Edge`, verify live execution + kill-and-auto-revive under `NT AUTHORITY\SYSTEM`, and archive Rule 11 logs.

---

## 5. Verification Plan (Rule 3)

| Target / Dependent Area | Expected State | Verification Method |
|---|---|---|
| `\Edge` Principal & Settings | `UserId=NT AUTHORITY\SYSTEM` (or `SYSTEM`), `LogonType=ServiceAccount`, `RunLevel=Highest`, `AtStartup`/`AtLogOn`/`PT1M` triggers active | Inspect `(Get-ScheduledTask 'Edge')` |
| Runtime Account (`SYSTEM`) | Active `wscript.exe` and `C:\ddudduddu\edge.exe` processes report owner `NT AUTHORITY\SYSTEM` (`GetOwner()`) | `Get-CimInstance Win32_Process` + `Invoke-CimMethod GetOwner` |
| Live Kill & Auto-Revive under `SYSTEM` | Stopping `edge.exe` (`taskkill`) causes `SYSTEM` watchdog to revive `C:\ddudduddu\edge.exe` within `<= 5s` as `NT AUTHORITY\SYSTEM` | `taskkill` -> sleep `5s` -> check PIDs & owner |
| NTFS Owner & ACL Lockdown | Owner is `NT AUTHORITY\SYSTEM`; `Authenticated Users:(M)` removed; only `SYSTEM:(F)`, `Administrators:(F)`, `Users:(RX)` present on folder and both files | `icacls` readback + `(Get-Acl).Owner` |
| Rule 11 backup & log integrity | Pre-modification `Tasks\Edge`, ACL snapshot, `edge_watchdog.vbs`, and archived logs exist and are > 0 bytes | File size checks |
