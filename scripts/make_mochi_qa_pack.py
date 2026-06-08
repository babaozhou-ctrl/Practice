from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = [
    ROOT / "scripts" / "export_mochi_placeholder_atlas.py",
    ROOT / "scripts" / "make_mochi_preview.py",
    ROOT / "scripts" / "make_mochi_contact_sheet.py",
    ROOT / "scripts" / "make_mochi_animation_previews.py",
]


def main() -> None:
    python = sys.executable
    for script in SCRIPTS:
        print(f"running {script.name}")
        subprocess.run([python, str(script)], cwd=ROOT, check=True)

    print("Mochi QA pack complete.")
    print(f"Atlas: {ROOT / 'public' / 'pets' / 'mochi' / 'sprite-atlas.png'}")
    print(f"Preview: {ROOT / 'public' / 'pets' / 'mochi' / 'preview.png'}")
    print(f"Contact sheet: {ROOT / 'pets' / 'mochi' / 'qa' / 'contact-sheet.png'}")
    print(f"Previews: {ROOT / 'pets' / 'mochi' / 'qa' / 'previews'}")


if __name__ == "__main__":
    main()
