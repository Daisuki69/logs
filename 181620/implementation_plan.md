# Delete `C:\ProgramData\PhoenixOS` & Dependent Shortcut Cleanup Plan

## 1. Investigation Summary & Dependents

`C:\ProgramData\PhoenixOS` (`60` items / `45` files, **`25.76 MB`**) is **not** Android Phoenix OS — it is the **Windows X-Lite (FBConan) optional tools & extras directory** shipped with your modified Windows build:
- `0ptional\` (Windows Registry `.reg` tweaks, `MS_Store.msix`, `Firefox Installer.exe`, `Fix Xbox Sign In`, `Printing Enabler.lnk`, `Windows X-Lite Info`)
- `Apps\Clear\Clear.exe` & `Clear.lnk`
- `FireWall\FirewallON.cmd` / `FirewallOFF.cmd`, `SpoolerSVC\SpoolerSVC ON.cmd` / `OFF.cmd`, `UpdateSVC\UpdateSVC ON.cmd` / `OFF.cmd`
- `Icons\` (`FBConan.ico`, `RB00..RB03.ico`, `WindowsXLite.ico`, etc.)

### Dependent Links & Startup Items Pointing into `C:\ProgramData\PhoenixOS`
Core Windows, Recycle Bin icons (`imageres.dll,-55/-54`), wallpaper, services, and scheduled tasks do **not** depend on `C:\ProgramData\PhoenixOS`. However, **10 shortcuts** point directly into it:
1. `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\Clear.lnk` -> runs `C:\ProgramData\PhoenixOS\Apps\Clear\Clear.exe` at startup
2. `C:\Extras + Info.lnk` -> opens `C:\ProgramData\PhoenixOS\0ptional` (icon: `Icons\WindowsXLite.ico`)
3. `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\X-Lite Tools\` (7 shortcuts):
   - `0ptional.lnk`, `Windows FireWall Off.lnk`, `Windows FireWall On.lnk`, `Windows Print Spooler Off.lnk`, `Windows Print Spooler On.lnk`, `Windows Update Service Off.lnk`, `Windows Update Service On.lnk`
4. `C:\Users\Admin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\File Explorer.lnk` -> `IconLocation` points to `C:\ProgramData\PhoenixOS\Icons\FBConan.ico,0`

**Impact if deleted without cleaning shortcuts**: Startup would attempt to run a missing `Clear.exe`, and `X-Lite Tools` / `C:\Extras + Info.lnk` / `File Explorer.lnk` would have broken targets/missing icons. Cleaning/updating those shortcuts avoids dead startup references and blank icons (while removing the X-Lite toggle shortcuts).

---

## 2. Rule 11 Pre-Modification Backup Plan

Create `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` before any deletion/modification:
- Copy full `C:\ProgramData\PhoenixOS` (`25.76 MB` — recoverable if you ever need `MS_Store.msix`, X-Lite `.reg`/`.cmd` tools, or icons later)
- Copy `C:\Extras + Info.lnk`
- Copy `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\Clear.lnk`
- Copy `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\X-Lite Tools\` (7 `.lnk`s)
- Copy `C:\Users\Admin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\File Explorer.lnk`
- Verify all backed-up files match source byte sizes (> 0 bytes) before modifying live files.

---

## 3. Execution Steps (After Explicit User Approval)

1. Run Rule 11 pre-modification backups into `C:\AI Logs\<DATE>\<TIMESTAMP>\files\` and verify non-zero file sizes.
2. Delete `C:\ProgramData\PhoenixOS` (`Remove-Item -LiteralPath 'C:\ProgramData\PhoenixOS' -Recurse -Force`).
3. Clean up the orphaned dependent shortcuts:
   - Delete `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\Clear.lnk`
   - Delete `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\X-Lite Tools`
   - Delete `C:\Extras + Info.lnk`
   - Update `C:\Users\Admin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\File Explorer.lnk` `IconLocation` from `C:\ProgramData\PhoenixOS\Icons\FBConan.ico,0` to `C:\Windows\explorer.exe,0`
4. Verify deletions/updates and archive `implementation_plan.md`, `transcript.jsonl`, and `transcript_full_snippet.jsonl` per Rule 11.

---

## 4. Verification Plan (Rule 3)

| Target / Dependent Area | Expected State | Verification Method |
|---|---|---|
| `C:\ProgramData\PhoenixOS` | Does not exist (`Exists=False`) | `Test-Path -LiteralPath 'C:\ProgramData\PhoenixOS'` |
| Dependent broken shortcuts | `Startup\Clear.lnk`, `X-Lite Tools`, and `C:\Extras + Info.lnk` do not exist (`Exists=False`) | `Test-Path` checks |
| `Start Menu\...\File Explorer.lnk` | Exists and `IconLocation` points to `C:\Windows\explorer.exe,0` (no `PhoenixOS` reference) | `WScript.Shell` shortcut readback |
| Core Windows OS stability | `Explorer`, Recycle Bin `DefaultIcon` (`imageres.dll,-55/-54`), and Startup folder remain valid without broken links | `Get-ChildItem` on Startup & `DefaultIcon` registry check |
| Rule 11 backup & log integrity | `PhoenixOS` backup + `.lnk` backups + archived `implementation_plan.md`, `transcript.jsonl`, `transcript_full_snippet.jsonl` exist and are > 0 bytes | File count & size check |
