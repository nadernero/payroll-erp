Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(currentDir)

cmd = "cmd.exe /c cd /d """ & rootDir & """ && node scripts\sync-biometric.js --silent"
WshShell.Run cmd, 0, False
