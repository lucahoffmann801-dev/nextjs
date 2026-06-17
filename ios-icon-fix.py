#!/usr/bin/env python3
"""
ios-icon-fix.py
Installiert Pillow falls nötig, liest ~/Downloads/KretaAppLogo.png,
skaliert auf 180/192/512px (Transparenz erhalten), legt Icons + manifest.json
an und patcht app/layout.tsx.
Guard: Abbruch wenn apple-touch-icon.png bereits existiert.
"""
import sys, subprocess, re
from pathlib import Path

# Pillow sicherstellen
try:
    from PIL import Image
except ImportError:
    print("  Pillow nicht gefunden, installiere...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

ROOT = Path(__file__).parent
LOGO = Path.home() / "Downloads" / "KretaAppLogo.png"

# Guard
guard = ROOT / "public" / "apple-touch-icon.png"
if guard.exists():
    print("ABBRUCH: apple-touch-icon.png existiert bereits.")
    sys.exit(0)

# Logo prüfen
if not LOGO.exists():
    print(f"FEHLER: {LOGO} nicht gefunden.")
    sys.exit(1)

img = Image.open(LOGO)
print(f"  Logo geladen: {img.size}, Modus: {img.mode}")
if img.mode not in ("RGBA", "LA", "PA"):
    img = img.convert("RGBA")

# Icons skalieren
sizes = {
    "public/apple-touch-icon.png": 180,
    "public/icon-192.png": 192,
    "public/icon-512.png": 512,
}
for rel, size in sizes.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(p, "PNG", optimize=True)
    print(f"  Geschrieben: {rel} ({p.stat().st_size} B)")

# manifest.json
mf = ROOT / "public" / "manifest.json"
mf.write_text('''{
  "name": "Kreta 2026",
  "short_name": "Kreta",
  "description": "Reiseplanung Luca & Jan · 01.-09. Juli 2026",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fbfdf9",
  "theme_color": "#0e302e",
  "icons": [
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}''', encoding="utf-8")
print("  Geschrieben: public/manifest.json")

# layout.tsx patchen
layout = ROOT / "app" / "layout.tsx"
if not layout.exists():
    print(f"FEHLER: {layout} nicht gefunden.")
    sys.exit(1)

src = layout.read_text(encoding="utf-8")

if "apple-touch-icon" in src:
    print("  layout.tsx: apple-touch-icon bereits vorhanden, uebersprungen.")
else:
    icons_block = (
        '  icons: {\n'
        '    apple: "/apple-touch-icon.png",\n'
        '    icon: [\n'
        '      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },\n'
        '      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },\n'
        '    ],\n'
        '  },\n'
    )
    manifest_prop = '  manifest: "/manifest.json",\n'

    m = re.search(r"(  description: [^\n]+\n)", src)
    if m:
        old = m.group(1)
        assert src.count(old) == 1, f"Mismatch: kommt {src.count(old)}x vor"
        src = src.replace(old, old + icons_block + manifest_prop)
        print("  layout.tsx: icons + manifest hinzugefuegt")
    else:
        pos = src.rfind("};")
        if pos != -1:
            src = src[:pos] + icons_block + manifest_prop + src[pos:]
            print("  layout.tsx: icons + manifest via Fallback hinzugefuegt")
        else:
            print("  WARNUNG: Kein Anker gefunden — bitte manuell ergaenzen.")

    layout.write_text(src, encoding="utf-8")
    print("  layout.tsx: gespeichert")

print()
print("FERTIG")
print("Commit-Vorschlag:")
print("  fix: use new KretaAppLogo for apple-touch-icon and PWA manifest")
