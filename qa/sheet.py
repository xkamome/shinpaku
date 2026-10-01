# Build a contact sheet from screenshots: python sheet.py <dir> <prefix> <out> [cols] [width]
import sys, glob, os
from PIL import Image
d, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
w = int(sys.argv[5]) if len(sys.argv) > 5 else 300
files = sorted(f for f in glob.glob(os.path.join(d, prefix + '*.png')))
ims = [Image.open(f) for f in files]
if not ims: sys.exit('no files')
h = int(ims[0].height * w / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6), (40, 40, 40))
for i, im in enumerate(ims):
    im = im.convert('RGB').resize((w, h), Image.LANCZOS)
    sheet.paste(im, ((i % cols) * (w + 6), (i // cols) * (h + 6)))
sheet.save(out, quality=85)
print(out, len(ims), sheet.size)
