"""
把一张已经抠好背景的人物照片（RGBA PNG）转成本作人物立绘的画风（2026-10-18，和张卫国 zwg 同一路子）：
  色块化（亮 / 中 / 暗 三档 + 衬衫白）+ 暗红描线 + 外轮廓线 + 一层错开的米色阴影，背景透明。
用法：python3 tools/stylize_char.py 输入.png 输出.webp [主色 hex，如 #8592b3]
"""
import sys
import numpy as np, cv2
from PIL import Image

def hexrgb(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.float32)

def stylize(src, base='#8592b3', height=1000):
    im = Image.open(src).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox(); im = im.crop(bb)
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    a = np.array(im)
    rgb = a[..., :3].astype(np.uint8); alpha = (a[..., 3] > 110).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    sm = cv2.bilateralFilter(rgb, 9, 60, 9)
    sm = cv2.medianBlur(sm, 5)
    hsv = cv2.cvtColor(sm, cv2.COLOR_RGB2HSV).astype(np.float32)
    L = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB)[..., 0].astype(np.float32)
    vals = L[alpha > 0]
    t_dark, t_mid, t_white = np.percentile(vals, 30), np.percentile(vals, 58), np.percentile(vals, 93)
    b = hexrgb(base)
    light = b + (255 - b) * 0.62; mid = b; dark = b * 0.62; white = np.array([246, 246, 250], np.float32)
    out = np.zeros((*L.shape, 3), np.float32)
    out[L <= t_dark] = dark
    out[(L > t_dark) & (L <= t_mid)] = mid
    out[L > t_mid] = light
    lowsat = hsv[..., 1] < 40
    out[(L > t_white) & lowsat] = white      # 白衬衫、反光
    # 色块边缘再平滑一下，避免碎点
    out = cv2.medianBlur(cv2.medianBlur(out.astype(np.uint8), 9), 7).astype(np.float32)
    # 描线：XDoG 风格（两次高斯相减）+ Canny，只保留较长的线段
    g = cv2.cvtColor(sm, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    d = cv2.GaussianBlur(g, (0, 0), 1.0) - 0.985 * cv2.GaussianBlur(g, (0, 0), 1.9)
    lines = (d < -0.012).astype(np.uint8)
    can = cv2.Canny(cv2.GaussianBlur(sm, (5, 5), 0), 60, 140) > 0
    lines = ((lines > 0) | can).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(lines, 8)
    keep = np.zeros_like(lines)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 55: keep[lab == i] = 1
    keep = cv2.dilate(keep, np.ones((2, 2), np.uint8))
    keep[alpha == 0] = 0
    LINE = np.array([110, 22, 30], np.float32)
    out[keep > 0] = LINE
    # 外轮廓线 + 错开的米色阴影
    edge = cv2.dilate(alpha, np.ones((7, 7), np.uint8)) - cv2.erode(alpha, np.ones((3, 3), np.uint8))
    pad = 24
    H, W = alpha.shape
    canvas = np.zeros((H, W + pad, 4), np.uint8)
    sh = np.zeros((H, W + pad), np.uint8); sh[:, 14:14 + W] = cv2.dilate(alpha, np.ones((5, 5), np.uint8))
    canvas[sh > 0] = [232, 210, 172, 255]
    full = np.zeros((H, W + pad), np.uint8); full[:, :W] = cv2.dilate(alpha, np.ones((5, 5), np.uint8))
    body = np.zeros((H, W + pad, 3), np.float32); body[:, :W] = out
    e2 = np.zeros((H, W + pad), np.uint8); e2[:, :W] = edge
    m = full > 0
    canvas[m, :3] = body[m].astype(np.uint8); canvas[m, 3] = 255
    canvas[e2 > 0] = [110, 22, 30, 255]
    return Image.fromarray(canvas, 'RGBA')

if __name__ == '__main__':
    img = stylize(sys.argv[1], sys.argv[3] if len(sys.argv) > 3 else '#8592b3')
    img.save(sys.argv[2], quality=88, method=6) if sys.argv[2].endswith('.webp') else img.save(sys.argv[2])
    print(img.size)
