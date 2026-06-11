; Inno Setup script for the Bonner Hour Dashboard.
; Per-user install (no admin prompt): files land in {localappdata}\Programs.
;
; Compiled in CI (see .github/workflows/release-builds.yml):
;   iscc packaging\installer.iss /DSourceDir=..\backend\dist\BonnerDashboard /DOutName=BonnerDashboard-windows-x64-setup
;
; SourceDir = the PyInstaller output folder, OutName = installer file name.

#ifndef SourceDir
  #define SourceDir "..\backend\dist\BonnerDashboard"
#endif
#ifndef OutName
  #define OutName "BonnerDashboard-setup"
#endif

[Setup]
AppId={{B0NNERDASH-0000-4000-8000-000000000001}
AppName=Bonner Hour Dashboard
AppVersion=1.0
AppPublisher=Bonner Hour Dashboard
DefaultDirName={localappdata}\Programs\BonnerDashboard
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=.\out
OutputBaseFilename={#OutName}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\BonnerDashboard.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Bonner Hour Dashboard"; Filename: "{app}\BonnerDashboard.exe"
Name: "{userdesktop}\Bonner Hour Dashboard"; Filename: "{app}\BonnerDashboard.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\BonnerDashboard.exe"; Description: "{cm:LaunchProgram,Bonner Hour Dashboard}"; Flags: nowait postinstall skipifsilent
