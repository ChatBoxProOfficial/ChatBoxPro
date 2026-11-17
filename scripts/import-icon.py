"""把一张现成图片装成 ChatBox Pro 的图标（.ico，多尺寸）。

用法：
    python import-icon.py 图片路径 [--round]

- 自动裁成正方形（居中裁切），再生成 16~256 的 .ico；
- 原图小于 256 时只做等比放大到 256，不再往更小的尺寸硬缩，尽量保住原画质；
- --round 会给图片加圆角底板（原图是直角底板时用）。
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

SIZES = [16, 24, 32, 48, 64, 128, 256]


def squarify(im: Image.Image) -> Image.Image:
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def add_round(im: Image.Image, radius_ratio: float = 0.225) -> Image.Image:
    size = im.size[0]
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("用法: python import-icon.py 图片路径 [--round]")

    src = sys.argv[1]
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    assets = os.path.join(root, "assets")

    im = Image.open(src).convert("RGBA")
    im = squarify(im)
    if "--round" in sys.argv:
        im = add_round(im)

    # 统一到 256 作为基准（.ico 里最大也就 256）
    base = im.resize((256, 256), Image.LANCZOS) if im.size[0] != 256 else im

    ico = os.path.join(assets, "chatbox-pro.ico")
    base.save(
        ico,
        format="ICO",
        sizes=[(s, s) for s in SIZES if s <= 256],
    )
    base.save(os.path.join(assets, "chatbox-pro.png"))

    print(f"源图: {src} {Image.open(src).size}")
    print(f"已生成: {ico}")
    print(f"预览图: {os.path.join(assets, 'chatbox-pro.png')}")


if __name__ == "__main__":
    main()
