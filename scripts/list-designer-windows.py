import ctypes
import subprocess
from ctypes import wintypes

user32 = ctypes.windll.user32


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


out = subprocess.check_output(
    ["powershell", "-Command", "Get-Process -Name 'LVGL-UI-Designer' | Select-Object -ExpandProperty Id"],
    text=True,
)
pids = [int(x.strip()) for x in out.split() if x.strip().isdigit()]
print("pids", pids)

results = []


def cb(hwnd, _):
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value in pids:
        visible = user32.IsWindowVisible(hwnd)
        length = user32.GetWindowTextLengthW(hwnd) + 1
        buf = ctypes.create_unicode_buffer(length)
        user32.GetWindowTextW(hwnd, buf, length)
        rect = RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w, h = rect.right - rect.left, rect.bottom - rect.top
        results.append((w * h, w, h, int(hwnd), buf.value, visible))
    return True


WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumWindows(WNDENUMPROC(cb), 0)

for area, w, h, hwnd, title, visible in sorted(results, reverse=True):
    print(f"{w}x{h} hwnd={hwnd} visible={visible} title={title!r}")
