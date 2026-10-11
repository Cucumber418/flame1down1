"""
把照片转成游戏里统一的手绘背景风格（色块 + 墨线 + 纸张颗粒），宽度统一 1400。

用法：python3 tools/stylize_bg.py 输入照片.jpg images/backgrounds/输出名.jpg
需要：pip install opencv-python numpy

注意：转换前先把照片里的水印、品牌标识、广告文字去掉（游戏不商用，但参考图里的标识都不保留）。
2026-10 的孝感大厅就是先在 2 倍尺寸上去掉场馆名、记分屏、队标、广告、国旗，换上「荆楚号 · 孝感大厅」大屏和段位横幅，再用这个脚本转换的。
"""
import sys
import cv2
import numpy as np

def stylize(img, out_w=1400):
    img = cv2.resize(img, (out_w, round(img.shape[0] * out_w / img.shape[1])), interpolation=cv2.INTER_AREA)
    # 色块：多次保边平滑 + 均值漂移
    s = img
    for _ in range(4):
        s = cv2.bilateralFilter(s, 9, 38, 7)
    s = cv2.pyrMeanShiftFiltering(s, 7, 22)
    # 墨线：在平滑后的图上找边
    g = cv2.medianBlur(cv2.cvtColor(s, cv2.COLOR_BGR2GRAY), 5)
    e = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 5)
    e = cv2.morphologyEx(e, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    ink = cv2.GaussianBlur((255 - e).astype(np.float32) / 255, (0, 0), 0.7)[..., None]
    out = s.astype(np.float32) * (1 - 0.72 * ink) + np.array([30, 24, 22], np.float32) * 0.216 * ink
    # 略提亮、提饱和
    hsv = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 1.08
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.04 + 4, 0, 255)
    out = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    # 纸张颗粒
    noise = cv2.GaussianBlur(np.random.default_rng(7).normal(0, 1, out.shape[:2]).astype(np.float32), (0, 0), 0.8) * 5
    return np.clip(out + noise[..., None], 0, 255).astype(np.uint8)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    src = cv2.imread(sys.argv[1])
    if src is None:
        sys.exit('读不到图片：' + sys.argv[1])
    cv2.imwrite(sys.argv[2], stylize(src), [cv2.IMWRITE_JPEG_QUALITY, 86])
    print('已保存', sys.argv[2])
