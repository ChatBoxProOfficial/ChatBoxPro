"""生成 ChatBox Pro 的图标候选（多方案、多尺寸 .ico）。

用法：
    python make-icon.py                 # 生成全部候选到 assets/candidates/
    python make-icon.py --apply b       # 把方案装成正式图标 assets/chatbox-pro.ico
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFilter

BASE = 1024
SS = 4
S = BASE * SS


def lerp(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def gradient(size, top, bottom, diag=0.35):
    img = Image.new("RGB", (size, size))
    px = img.load()
    step = 4
    for y in range(size):
        for x in range(0, size, step):
            t = min(1.0, max(0.0, x / size * diag + y / size * (1 - diag)))
            c = lerp(top, bottom, t)
            for dx in range(step):
                if x + dx < size:
                    px[x + dx, y] = c
    return img


def squircle(size, radius_ratio=0.225, pad_ratio=0.03):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    pad = int(size * pad_ratio)
    d.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=int(size * radius_ratio),
        fill=255,
    )
    return mask


def top_highlight(size):
    """顶部一层很淡的高光，让底板不那么平。"""
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(hl)
    h = int(size * 0.55)
    for i in range(h):
        a = int(26 * (1 - i / h) ** 2)
        d.line([(0, i), (size, i)], fill=(255, 255, 255, a))
    m = squircle(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(hl, (0, 0), m)
    return out


def bubble_mask(size, radius_ratio=0.30):
    """气泡造型：圆角矩形 + 左下角尾巴，合成单一半透明模版。"""
    layer = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(layer)

    x0, y0 = int(size * 0.225), int(size * 0.235)
    x1, y1 = int(size * 0.775), int(size * 0.615)
    r = int((y1 - y0) * radius_ratio)
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)

    # 尾巴：从气泡底边探出，尖端朝左下
    tip = (x0 - int(size * 0.045), y1 + int(size * 0.135))
    d.polygon(
        [
            (x0 + int(size * 0.015), y1 - int(size * 0.105)),
            tip,
            (x0 + int(size * 0.245), y1 - int(size * 0.02)),
        ],
        fill=255,
    )
    return layer


def drop_shadow(mask, size, blur_ratio=0.03, dy_ratio=0.022, alpha=90):
    a = mask.filter(ImageFilter.GaussianBlur(int(size * blur_ratio)))
    a = a.point(lambda v: int(v * alpha / 255))
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow.putalpha(a)
    return shadow, int(size * dy_ratio)


def paint_from_mask(mask, color=None, grad=None, size=S):
    if grad is not None:
        layer = grad.convert("RGBA")
    else:
        layer = Image.new("RGBA", (size, size), color)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(layer, (0, 0), mask)
    return out


def dots(size, color, y_ratio=0.425, r_ratio=0.046):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rad = int(size * r_ratio)
    cy = int(size * y_ratio)
    gap = int(size * 0.098)
    cx = int(size * 0.5)
    for off in (-gap, 0, gap):
        d.ellipse([cx + off - rad, cy - rad, cx + off + rad, cy + rad], fill=color)
    return layer


def spark(size, color, cx_ratio=0.745, cy_ratio=0.255, r_ratio=0.075):
    """右上角的小星芒，给"Pro"一点锐度。"""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = int(size * cx_ratio), int(size * cy_ratio)
    r = size * r_ratio
    d.polygon(
        [
            (cx, cy - r),
            (cx + r * 0.26, cy - r * 0.26),
            (cx + r, cy),
            (cx + r * 0.26, cy + r * 0.26),
            (cx, cy + r),
            (cx - r * 0.26, cy + r * 0.26),
            (cx - r, cy),
            (cx - r * 0.26, cy - r * 0.26),
        ],
        fill=color,
    )
    return layer


def compose(style: str) -> Image.Image:
    if style == "a":  # 蓝 → 靛紫，白气泡
        top, bottom = (86, 152, 255), (68, 52, 198)
        bubble_fill = (255, 255, 255, 255)
        dot = (56, 104, 214, 255)
        spark_c = (255, 214, 102, 255)
    elif style == "b":  # 石墨 + 渐变蓝气泡
        top, bottom = (40, 45, 54), (14, 16, 20)
        bubble_fill = None
        dot = (255, 255, 255, 255)
        spark_c = (110, 200, 255, 255)
    elif style == "c":  # 橙 → 玫红
        top, bottom = (255, 156, 72), (198, 42, 92)
        bubble_fill = (255, 255, 255, 255)
        dot = (206, 62, 96, 255)
        spark_c = (255, 240, 180, 255)
    else:
        raise SystemExit(f"未知方案: {style}")

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg = gradient(S, top, bottom)
    canvas.paste(bg, (0, 0), squircle(S))
    canvas.alpha_composite(top_highlight(S))

    mask = bubble_mask(S)
    sh, dy = drop_shadow(mask, S)
    canvas.alpha_composite(sh, (0, dy))

    if bubble_fill is None:
        bgrad = gradient(S, (96, 172, 255), (46, 104, 246), diag=0.6)
        canvas.alpha_composite(paint_from_mask(mask, grad=bgrad))
    else:
        canvas.alpha_composite(paint_from_mask(mask, color=bubble_fill))

    canvas.alpha_composite(dots(S, dot))
    if style != "b":
        canvas.alpha_composite(spark(S, spark_c))

    return canvas.resize((BASE, BASE), Image.LANCZOS)


def main() -> None:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    assets = os.path.join(root, "assets")
    cand = os.path.join(assets, "candidates")
    os.makedirs(cand, exist_ok=True)

    styles = ["a", "b", "c"]
    imgs = {}
    for s in styles:
        imgs[s] = compose(s)
        p = os.path.join(cand, f"icon-{s}.png")
        imgs[s].save(p)
        print(f"候选 {s}: {p}")

    if "--apply" in sys.argv:
        pick = sys.argv[sys.argv.index("--apply") + 1]
        if pick not in imgs:
            raise SystemExit("方案必须是 a / b / c")
        img = imgs[pick]
        ico = os.path.join(assets, "chatbox-pro.ico")
        img.save(ico, format="ICO", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
        img.save(os.path.join(assets, "chatbox-pro.png"))
        print(f"\n已应用方案 {pick} -> {ico}")


if __name__ == "__main__":
    main()
