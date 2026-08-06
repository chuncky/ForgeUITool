#ifndef FORGE_LOADER_H
#define FORGE_LOADER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Opaque A2 UI package handle (FR-041 / M6 Loader reference). */
typedef struct forge_ui_package forge_ui_package_t;

typedef struct {
    uint16_t width;
    uint16_t height;
    uint8_t color_depth;
    uint8_t lvgl_major;
} forge_loader_caps_t;

/** @return 0 on success; negative E_LOADER_* on failure */
int forge_loader_open_file(const char *path, forge_ui_package_t **out);
/** @param buf JSON: {"format":"forgeui-mem-ref","root":"/flash/pkg"} — root points at A2 on-flash layout */
int forge_loader_open_mem(const void *buf, size_t len, forge_ui_package_t **out);
int forge_loader_check_compat(const forge_ui_package_t *pkg, const forge_loader_caps_t *caps);
int forge_loader_apply(forge_ui_package_t *pkg);
/** Pure A2 JSON runtime path (label/button/container subset); LVGL build needs FORGE_LOADER_WITH_LVGL */
int forge_loader_apply_json(forge_ui_package_t *pkg);
void forge_loader_close(forge_ui_package_t *pkg);

#define E_LOADER_OK        0
#define E_LOADER_FMT      -1
#define E_LOADER_VER      -2
#define E_LOADER_RES      -3
#define E_LOADER_NOT_IMPL -4

#ifdef __cplusplus
}
#endif

#endif
