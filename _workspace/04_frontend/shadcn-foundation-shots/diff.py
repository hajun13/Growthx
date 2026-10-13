# usage: python diff.py <labelA> <labelB>  — 페이지별 픽셀 차이 비율 + 차이 맵(diff__*.png)
import sys, glob, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]
for fa in sorted(glob.glob(f'{a}__*.png')):
    name = fa[len(a)+2:]
    fb = f'{b}__{name}'
    if not os.path.exists(fb): continue
    ia, ib = Image.open(fa).convert('RGB'), Image.open(fb).convert('RGB')
    d = ImageChops.difference(ia, ib)
    bbox = d.getbbox()
    px = sum(1 for p in d.convert('L').getdata() if p > 24)
    pct = 100 * px / (ia.width * ia.height)
    print(f'{name:28s} diff {pct:6.2f}%  bbox={bbox}')
    if bbox: d.point(lambda v: 255 if v > 24 else 0).save(f'diff__{b}__{name}')
