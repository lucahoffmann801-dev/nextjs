#!/usr/bin/env python3
"""
bottom-nav-fix.py
Entfernt karte, guide, packen aus der Bottom-Nav.
Guard: grid-cols-4 bereits vorhanden = bereits gepatcht.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PAGE = ROOT / "app" / "page.tsx"

if not PAGE.exists():
    print(f"FEHLER: {PAGE} nicht gefunden.")
    sys.exit(1)

src = PAGE.read_text(encoding="utf-8")

# Guard
if "grid-cols-4" in src:
    print("ABBRUCH: Bereits gepatcht (grid-cols-4 gefunden).")
    sys.exit(0)

# 1. views-Array: karte, guide, packen entfernen
old_views = '''const views: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "kosten", label: "Kosten" },
  { id: "reise", label: "Reise" },
  { id: "routen", label: "Routen" },
  { id: "karte", label: "Karte" },
  { id: "guide", label: "Guide" },
  { id: "packen", label: "Packen" },
];'''

new_views = '''const views: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "kosten", label: "Kosten" },
  { id: "reise", label: "Reise" },
  { id: "routen", label: "Routen" },
];'''

assert src.count(old_views) == 1, f"views-Array Mismatch: {src.count(old_views)}x gefunden"
src = src.replace(old_views, new_views)
print("  views-Array: karte, guide, packen entfernt")

# 2. grid-cols-7 → grid-cols-4
old_grid = 'className=\"mx-auto grid max-w-md grid-cols-7 gap-0.5\"'
new_grid = 'className=\"mx-auto grid max-w-md grid-cols-4 gap-0.5\"'

assert src.count(old_grid) == 1, f"grid-cols Mismatch: {src.count(old_grid)}x gefunden"
src = src.replace(old_grid, new_grid)
print("  Bottom-Nav: grid-cols-7 → grid-cols-4")

PAGE.write_text(src, encoding="utf-8")
print("  app/page.tsx: gespeichert")
print()
print("FERTIG")
print("Commit-Vorschlag:")
print("  fix: remove karte, guide, packen from bottom nav (4 tabs)")
