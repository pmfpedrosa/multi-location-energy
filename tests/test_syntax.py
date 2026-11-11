"""Compile all shipped Python without importing HA or writing cache files."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
component = root / "custom_components" / "multi_location_energy"
for source in component.glob("*.py"):
    compile(source.read_text(encoding="utf-8-sig"), str(source), "exec")
for source in component.rglob("*.json"):
    json.loads(source.read_text(encoding="utf-8-sig"))
print("All shipped Python compiles and JSON parses.")
