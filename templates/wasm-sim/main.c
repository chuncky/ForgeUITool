#include "forgeui_preview_config.h"
#include "ui.h"
#include "hal.h"

#include <stdio.h>
#include "lvgl.h"

#if defined(__EMSCRIPTEN__)
#include <emscripten.h>

static void forgeui_tick(void)
{
    lv_timer_handler();
}
#endif

int main(void)
{
    lv_init();

#if defined(FORGEUI_HAS_SDL) && LV_USE_SDL
    if(!forgeui_sdl_hal_init(FORGEUI_HOR_RES, FORGEUI_VER_RES)) {
        fprintf(stderr, "SDL display init failed\n");
        return 1;
    }
#else
    fprintf(stderr, "SDL backend not available — rebuild with SDL2 + LV_USE_SDL\n");
    return 1;
#endif

    ui_init();

#if defined(__EMSCRIPTEN__)
    emscripten_set_main_loop(forgeui_tick, 0, 1);
#else
    while(1) {
        uint32_t delay_ms = lv_timer_handler();
        if(delay_ms == LV_NO_TIMER_READY) delay_ms = LV_DEF_REFR_PERIOD;
    }
#endif

    return 0;
}
