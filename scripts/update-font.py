"""Optional UI font update: python -m pip install fonttools, then run this file."""
from pathlib import Path
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

root = Path(__file__).resolve().parent.parent
cache = root / "work"
cache.mkdir(exist_ok=True)
source = cache / "NotoSansSC.ttf"
if not source.exists():
    url = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
    with urlopen(url, timeout=60) as response:
        source.write_bytes(response.read())
font = instantiateVariableFont(TTFont(source), {"wght": 450}, inplace=True)
options = subset.Options()
options.layout_features = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=(root / "rive/assets/glyphs.txt").read_text(encoding="utf-8"))
subsetter.subset(font)
destination = root / "rive/assets/UI.ttf"
font.save(destination)
print(f"Updated {destination}")
