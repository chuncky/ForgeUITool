#ifndef FORGEUI_PREVIEW_HAL_H
#define FORGEUI_PREVIEW_HAL_H

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

lv_display_t *forgeui_sdl_hal_init(int32_t w, int32_t h);

#ifdef __cplusplus
}
#endif

#endif
