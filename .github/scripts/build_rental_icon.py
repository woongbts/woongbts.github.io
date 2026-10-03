from pathlib import Path
from cairosvg import svg2png
from PIL import Image

root=Path(__file__).resolve().parents[2]
assets=root/"rental/assets"
svg=(assets/"woongbi-rental-mark.svg").read_bytes()
for size in (32,180,192,512):
    out=assets/f"woongbi-rental-icon-{size}.png"
    svg2png(bytestring=svg,write_to=str(out),output_width=size,output_height=size)
img=Image.open(assets/"woongbi-rental-icon-32.png").convert("RGBA")
img.save(assets/"favicon.ico",format="ICO",sizes=[(32,32)])
