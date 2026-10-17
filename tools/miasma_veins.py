"""
给芙罗拉星的背景画上「深紫色瘴气脉络」（第八段结尾全星瘴气化之后用的版本）。

画法和游戏里的手绘背景统一：粗墨线描边 + 深紫色块 + 亮紫高光 + 一层紫色雾气和颗粒。
脉络从画面底边（和两侧）长出来，像树根一样分叉往上爬；strength 越大，脉络越多越粗、整体越暗越紫。

用法：python3 tools/miasma_veins.py 输入.jpg 输出.jpg [strength=1.0] [seed=1] [horizon=0.55] [core=x,y]
  horizon：地平线的高度（0~1，从上往下），脉络只长在地面上
  core：可选，脉络的源头（0~1 的相对坐标），比如盐碱地的地底核心 0.5,0.78；不写就从底边和两侧随机长出来
"""
import sys, math
import cv2
import numpy as np

INK = (34, 20, 30)          # 墨线（BGR）
DEEP = (92, 24, 64)         # 深紫
MID = (150, 52, 110)        # 中紫
HI = (205, 120, 190)        # 亮紫高光


def branch(rng, pts, x, y, ang, length, width, depth, H, W, hz):
    """从 (x, y) 朝 ang 方向长一根贴地的脉络：竖直方向按透视压扁，越靠近地平线 hz 越细；沿途随机弯曲、分叉。
    结果写进 pts：[(折线点列, 每点粗细)]"""
    path, ws = [(x, y)], []
    step = max(5.0, length / 22)
    travelled = 0.0
    def depthf(yy): return max(0.0, min(1.0, (yy - hz) / max(1.0, H - hz))) ** 0.9
    ws.append(width * depthf(y))
    while travelled < length and -60 <= x < W + 60 and y < H + 60:
        ang += rng.normal(0, 0.2)
        d = depthf(y)
        x += math.cos(ang) * step * (0.45 + 0.55 * d)
        y += math.sin(ang) * step * (0.12 + 0.38 * d)
        if y <= hz + 2: break
        travelled += step
        path.append((x, y)); ws.append(width * depthf(y) * (1 - 0.7 * travelled / length))
        if depth > 0 and rng.random() < 0.1 and len(path) > 3:
            side = rng.choice([-1, 1])
            branch(rng, pts, x, y, ang + side * rng.uniform(0.5, 1.2), length * rng.uniform(0.35, 0.6), width * 0.6, depth - 1, H, W, hz)
    pts.append((path, ws))


def draw_veins(img, strength=1.0, seed=1, core=None, horizon=0.55):
    H, W = img.shape[:2]
    rng = np.random.default_rng(seed)
    base = img.astype(np.float32)

    # 整体先压暗、偏冷、降饱和一点：瘴气笼罩下的光线
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 1 - 0.28 * min(1, strength)
    hsv[..., 2] *= 1 - 0.18 * min(1.3, strength)
    dim = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    tint = np.zeros_like(dim); tint[:] = (95, 40, 85)
    # 越靠下越紫（瘴气贴着地面流）
    grad = np.linspace(0.08, 0.32, H, dtype=np.float32)[:, None, None] * min(1.4, strength)
    out = dim * (1 - grad) + tint * grad
    # 地面整片染上深紫（地平线以下，越往下越浓；strength 大于 1 时更明显）
    yy = np.arange(H, dtype=np.float32)[:, None, None]
    gmask = np.clip((yy - horizon * H) / max(1.0, (1 - horizon) * H), 0, 1) ** 0.8 * min(0.55, 0.22 * strength)
    out = out * (1 - gmask) + np.array((70, 22, 60), np.float32) * gmask

    # 生成脉络（hz：地平线高度，脉络只长在地面上）
    pts = []
    hz = horizon * H
    n = int(round((6 + 6 * strength) * W / 1400))
    scale = W / 1400
    if core:
        cx, cy = core[0] * W, core[1] * H
        for k in range(n + 8):
            a = rng.uniform(0, 2 * math.pi)
            branch(rng, pts, cx + rng.normal(0, 20 * scale), cy + rng.normal(0, 6 * scale), a, rng.uniform(500, 1100) * scale * (0.8 + 0.3 * strength), rng.uniform(16, 30) * scale * (0.8 + 0.25 * strength), 3, H, W, hz)
    else:
        for k in range(n):
            r = rng.random()
            if r < 0.6:    # 从底边往里爬
                x0, y0, a = rng.uniform(0, W), H + 8, -math.pi / 2 + rng.normal(0, 0.9)
            elif r < 0.8:   # 从左边
                x0, y0, a = -8, rng.uniform(hz + (H - hz) * 0.35, H), rng.normal(-0.15, 0.35)
            else:            # 从右边
                x0, y0, a = W + 8, rng.uniform(hz + (H - hz) * 0.35, H), math.pi + rng.normal(0.15, 0.35)
            branch(rng, pts, x0, y0, a, rng.uniform(420, 900) * scale * (0.75 + 0.35 * strength), rng.uniform(14, 26) * scale * (0.75 + 0.3 * strength), 3, H, W, hz)

    ink = np.zeros((H, W), np.uint8); body = np.zeros((H, W), np.uint8); hi = np.zeros((H, W), np.uint8)
    for path, ws in pts:
        P = np.array(path, np.float32)
        for i in range(len(P) - 1):
            ww = max(1.2, ws[i])
            p1 = tuple(np.round(P[i]).astype(int)); p2 = tuple(np.round(P[i + 1]).astype(int))
            cv2.line(ink, p1, p2, 255, max(2, int(round(ww + 3 * scale + 1.5))), cv2.LINE_AA)
            cv2.line(body, p1, p2, 255, max(1, int(round(ww))), cv2.LINE_AA)
            if ww > 5:
                cv2.line(hi, (p1[0], p1[1] - int(ww * 0.2)), (p2[0], p2[1] - int(ww * 0.2)), 255, max(1, int(round(ww * 0.22))), cv2.LINE_AA)

    # 发光：脉络周围一圈紫色光晕
    glow = cv2.GaussianBlur(body.astype(np.float32) / 255, (0, 0), 12 * scale + 4) * (0.7 + 0.3 * strength)
    glow = np.clip(glow, 0, 1)[..., None]
    out = out * (1 - 0.45 * glow) + np.array(MID, np.float32) * 0.45 * glow

    a_ink = (ink.astype(np.float32) / 255)[..., None]
    a_body = (body.astype(np.float32) / 255)[..., None]
    a_hi = (hi.astype(np.float32) / 255)[..., None]
    out = out * (1 - a_ink) + np.array(INK, np.float32) * a_ink
    # 色块里带一点明暗：沿脉络做个渐变（中间深、边缘中紫）
    shade = cv2.GaussianBlur(body.astype(np.float32) / 255, (0, 0), 2.2)[..., None]
    col = np.array(DEEP, np.float32) * shade + np.array(MID, np.float32) * (1 - shade)
    out = out * (1 - a_body) + col * a_body
    out = out * (1 - 0.6 * a_hi) + np.array(HI, np.float32) * 0.6 * a_hi

    # 核心：地底涌出瘴气的地方，一团发光的深紫
    if core:
        cx, cy = int(core[0] * W), int(core[1] * H)
        cm = np.zeros((H, W), np.float32)
        cv2.ellipse(cm, (cx, cy), (int(170 * scale * strength), int(34 * scale * strength)), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
        cg = cv2.GaussianBlur(cm, (0, 0), 30 * scale)[..., None]
        out = out * (1 - 0.8 * cg) + np.array((70, 14, 52), np.float32) * 0.8 * cg
        rim = cv2.GaussianBlur(cm, (0, 0), 6 * scale)
        rim = np.clip((rim - 0.35) * 3, 0, 1) * (1 - np.clip((rim - 0.75) * 4, 0, 1))
        out = out * (1 - 0.6 * rim[..., None]) + np.array(HI, np.float32) * 0.6 * rim[..., None]

    # 飘着的紫色雾气 + 纸张颗粒（和 stylize_bg.py 一样的颗粒）
    fog = cv2.GaussianBlur(rng.random((H // 8 + 1, W // 8 + 1)).astype(np.float32), (0, 0), 3)
    fog = cv2.resize(fog, (W, H))
    fog = np.clip((fog - 0.45) * 2.2, 0, 1)[..., None] * 0.22 * min(1.3, strength)
    out = out * (1 - fog) + np.array((120, 70, 120), np.float32) * fog
    noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 0.8) * 5
    return np.clip(out + noise[..., None], 0, 255).astype(np.uint8)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src = cv2.imread(sys.argv[1])
    st = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    sd = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    hzn = float(sys.argv[5]) if len(sys.argv) > 5 else 0.55
    core = tuple(float(v) for v in sys.argv[6].split(',')) if len(sys.argv) > 6 else None
    cv2.imwrite(sys.argv[2], draw_veins(src, st, sd, core, hzn), [cv2.IMWRITE_JPEG_QUALITY, 86])
