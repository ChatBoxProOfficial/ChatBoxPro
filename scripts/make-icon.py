"""生成 ChatBox Pro 的 Windows 图标（.ico，多尺寸）。"""
from PIL import Image, ImageDraw
import os

SIZES = [16, 24, 32, 48, 64, 128, 256]


def render(size: int) -> Image.Image:
    # 用 4 倍超采样再缩小，边缘干净
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角底板
    pad = int(s * 0.06)
    radius = int(s * 0.24)
    d.rounded_rectangle(
        [pad, pad, s - pad, s - pad], radius=radius, fill=(74, 140, 255, 255)
    )

    # 对话气泡
    bx0, by0 = int(s * 0.24), int(s * 0.28)
    bx1, by1 = int(s * 0.76), int(s * 0.62)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(s * 0.09), fill=(255, 255, 255, 245))

    # 气泡小尾巴
    d.polygon(
        [
            (int(s * 0.34), by1 - 2),
            (int(s * 0.30), int(s * 0.72)),
            (int(s * 0.47), by1 - 2),
        ],
        fill=(255, 255, 255, 245),
    )

    # 三个点
    cy = (by0 + by1) // 2
    r = int(s * 0.045)
    for cx in (int(s * 0.37), int(s * 0.50), int(s * 0.63)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(74, 140, 255, 255))

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = os.path.join(os.path.dirname(__file__), "..", "assets", "chatbox-pro.ico")
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)

    base = render(256)
    base.save(out, format="ICO", sizes=[(s, s) for s in SIZES])
    print("icon ->", out, os.path.getsize(out), "bytes")

    png = out.replace(".ico", ".png")
    base.resize((512, 512), Image.LANCZOS).save(png)
    print("png  ->", png)


if __name__ == "__main__":
    main()
