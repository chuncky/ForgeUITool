#include "forgeui_preview_config.h"
#include "ui.h"
#include "hal.h"

#include <stdio.h>
#include "lvgl.h"

#ifdef _WIN32
#include <Windows.h>
#else
#include <unistd.h>
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
    fprintf(stderr, "SDL backend not available — rebuild with SDL2\n");
    return 1;
#endif

    ui_init();

    while(1) {
        uint32_t delay_ms = lv_timer_handler();
        if(delay_ms == LV_NO_TIMER_READY) {
            delay_ms = LV_DEF_REFR_PERIOD;
        }
#ifdef _WIN32
        Sleep(delay_ms);
#else
        usleep(delay_ms * 1000);
#endif
    }

    return 0;
}
