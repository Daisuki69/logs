$src = @'
using System;
using System.Runtime.InteropServices;

public static class SessionLauncher {
    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSEnumerateSessions(IntPtr hServer, int Reserved, int Version, out IntPtr ppSessionInfo, out int pCount);

    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(IntPtr pMemory);

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSQueryUserToken(uint SessionId, out IntPtr phToken);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool DuplicateTokenEx(IntPtr hExistingToken, uint dwDesiredAccess, IntPtr lpTokenAttributes, int ImpersonationLevel, int TokenType, out IntPtr phNewToken);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool CreateEnvironmentBlock(out IntPtr lpEnvironment, IntPtr hToken, bool bInherit);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool DestroyEnvironmentBlock(IntPtr lpEnvironment);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessAsUserW(IntPtr hToken, string lpApplicationName, string lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    private struct WTS_SESSION_INFO {
        public int SessionId;
        public IntPtr pWinStationName;
        public int State;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    private static bool TryGetActiveUserToken(out IntPtr token) {
        token = IntPtr.Zero;
        uint consoleSid = WTSGetActiveConsoleSessionId();
        if (consoleSid != 0xFFFFFFFF && consoleSid != 0 && WTSQueryUserToken(consoleSid, out token)) {
            return true;
        }
        IntPtr pSessions = IntPtr.Zero;
        int count = 0;
        if (WTSEnumerateSessions(IntPtr.Zero, 0, 1, out pSessions, out count)) {
            try {
                int stride = Marshal.SizeOf(typeof(WTS_SESSION_INFO));
                for (int i = 0; i < count; i++) {
                    WTS_SESSION_INFO si = (WTS_SESSION_INFO)Marshal.PtrToStructure(new IntPtr(pSessions.ToInt64() + (long)i * stride), typeof(WTS_SESSION_INFO));
                    if (si.SessionId > 0 && si.State == 0 && WTSQueryUserToken((uint)si.SessionId, out token)) {
                        return true;
                    }
                }
            } finally {
                WTSFreeMemory(pSessions);
            }
        }
        return false;
    }

    public static bool Launch(string exePath, string workDir) {
        IntPtr hUser = IntPtr.Zero;
        IntPtr hPrimary = IntPtr.Zero;
        IntPtr lpEnv = IntPtr.Zero;
        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        try {
            if (!TryGetActiveUserToken(out hUser)) {
                return false;
            }
            if (!DuplicateTokenEx(hUser, 0x02000000, IntPtr.Zero, 2, 1, out hPrimary)) {
                return false;
            }
            uint flags = 0x00000020;
            if (CreateEnvironmentBlock(out lpEnv, hPrimary, false)) {
                flags |= 0x00000400;
            }
            STARTUPINFO si = new STARTUPINFO();
            si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
            si.lpDesktop = "winsta0\\default";
            si.dwFlags = 0x00000001;
            si.wShowWindow = 1;
            if (!CreateProcessAsUserW(hPrimary, exePath, "\"" + exePath + "\"", IntPtr.Zero, IntPtr.Zero, false, flags, lpEnv, workDir, ref si, out pi)) {
                return false;
            }
            return true;
        } finally {
            if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
            if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
            if (lpEnv != IntPtr.Zero) DestroyEnvironmentBlock(lpEnv);
            if (hPrimary != IntPtr.Zero) CloseHandle(hPrimary);
            if (hUser != IntPtr.Zero) CloseHandle(hUser);
        }
    }
}
'@

Add-Type -TypeDefinition $src -Language CSharp -ErrorAction Stop
$target = 'C:\ddudduddu\edge.exe'
$workDir = 'C:\ddudduddu'

while ($true) {
    $alive = $false
    foreach ($p in [System.Diagnostics.Process]::GetProcessesByName('edge')) {
        try {
            if ($p.SessionId -gt 0 -and $p.MainModule.FileName -ieq $target) {
                $alive = $true
                break
            }
        } catch {
        } finally {
            $p.Dispose()
        }
    }
    if (-not $alive) {
        [void][SessionLauncher]::Launch($target, $workDir)
    }
    Start-Sleep -Milliseconds 2000
}

