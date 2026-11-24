"""
给玩家头像算「头部」裁切框：读 js/data/assets.js 里所有精灵立绘（SPRITES / PRE_SPRITES / SHINY_SPRITES），
对每张图找头部所在的正方形区域，写进 js/data/avfocus.js：
  AV_FOCUS[图片路径] = [左, 上, 边长（都按图宽的比例）, 高宽比]
算法：取不透明像素的外框，正方形边长 ≈ 外框短边的 0.62，贴着外框顶部；水平位置取最上面这一段不透明像素的重心。
个别算得不好的，在 OVERRIDE 里手动写（同样的格式，按图宽比例）。
用法：python3 tools/avatar_focus.py   （需要 Pillow、numpy）
"""
import re, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OVERRIDE = {   # '图片路径': [l, t, s]（头不在最上面的）
    'images/sprites/glen.png': [0.55, 0.14, 0.38],
    'images/sprites/moon_v2.webp': [0.6, 0.12, 0.38], 'images/sprites/moon_full.webp': [0.6, 0.12, 0.38], 'images/sprites/moon_dark.webp': [0.6, 0.12, 0.38],
    'images/sprites/shroom.webp': [0.42, 0.06, 0.38],
    'images/sprites/tagore_v2.webp': [0.35, 0.0, 0.36], 'images/sprites/tagore_awake_v2.webp': [0.35, 0.0, 0.36],
    'images/sprites/wind.webp': [0.25, 0.13, 0.5], 'images/sprites/wind_miasma.webp': [0.25, 0.13, 0.5],
}

def focus(path):
    im = Image.open(os.path.join(ROOT, path)).convert('RGBA')
    W, H = im.size
    a = np.array(im.split()[3]) > 40
    ys, xs = np.nonzero(a)
    if not len(xs): return None
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    side = max(8, min(0.8 * min(bw, bh), 0.9 * bw))
    top = max(0, y0 - 0.03 * side)
    band = a[int(y0):int(min(H, y0 + side)), :]
    cols = band.sum(0)
    cx = (cols * np.arange(W)).sum() / max(1, cols.sum())
    left = min(max(0, cx - side / 2), W - side)
    top = min(top, H - side)
    return [round(left / W, 4), round(top / W, 4), round(side / W, 4), round(H / W, 4)]

def main():
    s = open(os.path.join(ROOT, 'js/data/assets.js'), encoding='utf8').read()
    paths = sorted(set(re.findall(r'"(images/(?:sprites|pre_sprites|shiny)[^"?]*\.(?:webp|png))', s)))
    out = {}
    for p in paths:
        if not os.path.exists(os.path.join(ROOT, p)): continue
        f = focus(p)
        if f: out[p] = (OVERRIDE[p] + [f[3]]) if p in OVERRIDE else f
    js = '/* 玩家头像的头部裁切框，由 tools/avatar_focus.py 生成，别手改（要调就改脚本里的 OVERRIDE 再重新生成）\n * AV_FOCUS[图片路径] = [左, 上, 边长（按图宽的比例）, 高宽比] */\nvar AV_FOCUS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, 'js/data/avfocus.js'), 'w', encoding='utf8').write(js)
    print(len(out), 'images')
    if len(sys.argv) > 1:   # 预览：python3 tools/avatar_focus.py 预览图.png
        n = len(out); cols = 12; S = 96
        sheet = Image.new('RGB', (cols * (S + 6), ((n + cols - 1) // cols) * (S + 6)), 'white')
        for i, (p, f) in enumerate(out.items()):
            im = Image.open(os.path.join(ROOT, p)).convert('RGBA'); W, H = im.size
            l, t, sd = f[0] * W, f[1] * W, f[2] * W
            c = im.crop((int(l), int(t), int(l + sd), int(t + sd))).resize((S, S))
            bg = Image.new('RGBA', (S, S), (235, 232, 220, 255)); bg.alpha_composite(c)
            sheet.paste(bg.convert('RGB'), ((i % cols) * (S + 6), (i // cols) * (S + 6)))
        sheet.save(sys.argv[1])

main()
