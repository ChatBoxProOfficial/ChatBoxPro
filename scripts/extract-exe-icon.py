"""从 .exe 里抽取内嵌图标（走 Windows 的 PrivateExtractIcons）。

用法：
    python extract-exe-icon.py 目标.exe 输出目录

会按 16/24/32/48/64/128/256 分别抽取并保存 PNG，
再用这些尺寸拼一个完整的 .ico（尽量保留原生分辨率）。
"""
from __future__ import annotations

import ctypes
import os
import sys
from ctypes import wintypes

from PIL import Image

SIZES = [16, 24, 32, 48, 64, 128, 256]

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

LR_DEFAULTCOLOR = 0x00000000
DI_NORMAL = 0x0003

# 64 位下句柄是 8 字节，必须显式声明，否则 ctypes 按 int 处理会溢出
HANDLE = wintypes.HANDLE

user32.GetDC.restype = wintypes.HDC
user32.GetDC.argtypes = [wintypes.HWND]
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.GetIconInfo.argtypes = [HANDLE, ctypes.c_void_p]
user32.GetIconInfo.restype = wintypes.BOOL
user32.DestroyIcon.argtypes = [HANDLE]
user32.DestroyIcon.restype = wintypes.BOOL
user32.PrivateExtractIconsW.argtypes = [
    wintypes.LPCWSTR,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.POINTER(HANDLE),
    ctypes.POINTER(HANDLE),
    wintypes.UINT,
    wintypes.UINT,
]
user32.PrivateExtractIconsW.restype = wintypes.UINT

gdi32.GetObjectW.argtypes = [HANDLE, ctypes.c_int, ctypes.c_void_p]
gdi32.GetObjectW.restype = ctypes.c_int
gdi32.DeleteObject.argtypes = [HANDLE]
gdi32.DeleteObject.restype = wintypes.BOOL
gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteDC.restype = wintypes.BOOL
gdi32.SelectObject.argtypes = [wintypes.HDC, HANDLE]
gdi32.SelectObject.restype = HANDLE
gdi32.GetDIBits.argtypes = [
    wintypes.HDC,
    HANDLE,
    wintypes.UINT,
    wintypes.UINT,
    ctypes.c_void_p,
    ctypes.c_void_p,
    wintypes.UINT,
]
gdi32.GetDIBits.restype = ctypes.c_int


class ICONINFO(ctypes.Structure):
    _fields_ = [
        ("fIcon", wintypes.BOOL),
        ("xHotspot", wintypes.DWORD),
        ("yHotspot", wintypes.DWORD),
        ("hbmMask", wintypes.HBITMAP),
        ("hbmColor", wintypes.HBITMAP),
    ]


class BITMAP(ctypes.Structure):
    _fields_ = [
        ("bmType", wintypes.LONG),
        ("bmWidth", wintypes.LONG),
        ("bmHeight", wintypes.LONG),
        ("bmWidthBytes", wintypes.LONG),
        ("bmPlanes", wintypes.WORD),
        ("bmBitsPixel", wintypes.WORD),
        ("bmBits", ctypes.c_void_p),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


def hicon_to_image(hicon) -> Image.Image | None:
    info = ICONINFO()
    if not user32.GetIconInfo(hicon, ctypes.byref(info)):
        return None
    try:
        bm = BITMAP()
        gdi32.GetObjectW(info.hbmColor, ctypes.sizeof(bm), ctypes.byref(bm))
        w, h = bm.bmWidth, bm.bmHeight
        if w <= 0 or h <= 0:
            return None

        hdc = user32.GetDC(None)
        memdc = gdi32.CreateCompatibleDC(hdc)
        bmi = BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.biWidth = w
        bmi.biHeight = -h  # 负数 = 自上而下
        bmi.biPlanes = 1
        bmi.biBitCount = 32
        bmi.biCompression = 0  # BI_RGB

        buf = ctypes.create_string_buffer(w * h * 4)
        gdi32.SelectObject(memdc, info.hbmColor)
        ok = gdi32.GetDIBits(memdc, info.hbmColor, 0, h, buf, ctypes.byref(bmi), 0)
        gdi32.DeleteDC(memdc)
        user32.ReleaseDC(None, hdc)
        if not ok:
            return None
        return Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).copy()
    finally:
        if info.hbmColor:
            gdi32.DeleteObject(info.hbmColor)
        if info.hbmMask:
            gdi32.DeleteObject(info.hbmMask)
        user32.DestroyIcon(hicon)


def extract(path: str, size: int) -> Image.Image | None:
    large = (HANDLE * 1)()
    small = (HANDLE * 1)()
    n = user32.PrivateExtractIconsW(
        ctypes.c_wchar_p(path), 0, size, size, large, small, 1, 0
    )
    if n <= 0:
        return None
    icons = []
    for arr in (large, small):
        for h in arr:
            if h:
                img = hicon_to_image(h)
                if img:
                    icons.append(img)
    if not icons:
        return None
    icons.sort(key=lambda i: i.size[0], reverse=True)
    return icons[0]


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("用法: python extract-exe-icon.py 目标.exe 输出目录")
    exe, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)

    found: dict[int, Image.Image] = {}
    for s in SIZES:
        img = extract(exe, s)
        if img is None:
            print(f"{s}: 没有")
            continue
        p = os.path.join(outdir, f"exe-icon-{s}.png")
        img.save(p)
        found[img.size[0]] = img
        print(f"{s}: 取到 {img.size[0]}x{img.size[1]} -> {p}")

    if not found:
        raise SystemExit("这个 exe 里没抽到图标")

    biggest = max(found)
    print(f"\n最大可用尺寸: {biggest}")

    ico_path = os.path.join(outdir, "exe-icon.ico")
    base = found[biggest]
    base.save(ico_path, format="ICO", sizes=[(s, s) for s in sorted(found) if s <= 256])
    print("打包 ico ->", ico_path)


if __name__ == "__main__":
    main()
