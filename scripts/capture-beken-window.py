"""Capture Beken LVGL UI Designer window and crop right property panel."""
import ctypes
import sys
import time
from pathlib import Path

from PIL import ImageGrab

user32 = ctypes.windll.user32


def find_window(title_part: str):
    result = []

    def cb(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd) + 1
            buf = ctypes.create_unicode_buffer(length)
            user32.GetWindowTextW(hwnd, buf, length)
            title = buf.value
            if title_part.lower() in title.lower():
                result.append((hwnd, title))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return result


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


def find_largest_designer_hwnd() -> int | None:
    import subprocess
    from ctypes import wintypes

    out = subprocess.check_output(
        ["powershell", "-Command", "Get-Process -Name 'LVGL-UI-Designer' | Select-Object -ExpandProperty Id"],
        text=True,
    )
    pids = {int(x.strip()) for x in out.split() if x.strip().isdigit()}
    best = None

    def cb(hwnd, _):
        nonlocal best
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value not in pids:
            return True
        rect = RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w, h = rect.right - rect.left, rect.bottom - rect.top
        area = w * h
        if area > 100000 and (best is None or area > best[0]):
            best = (area, int(hwnd))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return best[1] if best else None


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("captures")
    out_dir.mkdir(parents=True, exist_ok=True)

    hwnd = find_largest_designer_hwnd()
    if not hwnd:
        raise SystemExit("Designer window not found")
    print("Using hwnd", hwnd)

    # Restore and bring to front (SW_RESTORE=9).
    user32.ShowWindow(hwnd, 9)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.8)

    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    bbox = (rect.left, rect.top, rect.right, rect.bottom)
    img = ImageGrab.grab(bbox)
    full_path = out_dir / "_full-window.png"
    img.save(full_path)
    print(f"Saved {full_path} {img.size}")

    w, h = img.size
    panel_w = min(380, w // 3)
    right = img.crop((w - panel_w, 0, w, h))
    right_path = out_dir / "_right-panel-full.png"
    right.save(right_path)
    print(f"Saved {right_path} {right.size}")


if __name__ == "__main__":
    main()
