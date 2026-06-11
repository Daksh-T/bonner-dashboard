# PyInstaller spec for the Bonner Hour Dashboard desktop app.
#
# Build:  cd backend && uv run pyinstaller ../packaging/bonner.spec --noconfirm
# (or just run packaging/build.sh, which builds the frontend first.)

from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = Path(SPECPATH).parent  # repo root (packaging/ is one level down)

# Read-only assets bundled into the app; paths mirror BUNDLE_DIR layout in
# app/config.py so the packaged app finds them at runtime.
datas = [
    (str(ROOT / "frontend" / "dist"), "frontend/dist"),
    (str(ROOT / "csv"), "csv"),
    (str(ROOT / "exemptions.json"), "."),
    (str(ROOT / "support_tracking.json"), "."),
]

hiddenimports = collect_submodules("app") + collect_submodules("uvicorn")

# uvicorn ships data/loggers that PyInstaller misses without collect_all.
for pkg in ("uvicorn",):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    hiddenimports += pkg_hidden

block_cipher = None

a = Analysis(
    [str(ROOT / "backend" / "desktop.py")],
    pathex=[str(ROOT / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="BonnerDashboard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # GUI app: no terminal window
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    name="BonnerDashboard",
)

# On macOS, also produce a .app bundle.
import sys

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="BonnerDashboard.app",
        icon=None,
        bundle_identifier="edu.sewanee.bonnerdashboard",
    )
