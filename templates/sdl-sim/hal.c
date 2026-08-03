#include "hal.h"

#if defined(FORGEUI_HAS_SDL) && LV_USE_SDL
#include LV_SDL_INCLUDE_PATH
#include "drivers/sdl/lv_sdl_window.h"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#endif

lv_display_t *forgeui_sdl_hal_init(int32_t w, int32_t h)
{
    lv_group_t *group = lv_group_create();
    lv_group_set_default(group);

    lv_display_t *disp = lv_sdl_window_create(w, h);
    if(disp) {
        lv_display_set_antialiasing(disp, true);
    }

    SDL_DisplayMode dm;
    if(SDL_GetDesktopDisplayMode(0, &dm) == 0) {
        int screen_w = dm.w;
        int screen_h = dm.h;

#ifdef _WIN32
        RECT rc;
        if(SystemParametersInfo(SPI_GETWORKAREA, 0, &rc, 0)) {
            screen_w = (int)(rc.right - rc.left);
            screen_h = (int)(rc.bottom - rc.top);
        }
#endif

        float scale = 1.0f;
        if(screen_w < w || screen_h < h) {
            float scale_w = (float)screen_w / (float)w;
            float scale_h = (float)screen_h / (float)h;
            scale = scale_w < scale_h ? scale_w : scale_h;
            if(scale < 1.0f) scale *= 0.9f;
        }
        if(scale > 1.0f) scale = 1.0f;
        if(scale <= 0.0f) scale = 1.0f;

        lv_sdl_window_set_zoom(disp, scale);
        lv_sdl_window_center(disp);
    }

    lv_indev_t *mouse = lv_sdl_mouse_create();
    lv_indev_set_group(mouse, group);
    lv_indev_set_display(mouse, disp);
    lv_display_set_default(disp);

    lv_indev_t *mousewheel = lv_sdl_mousewheel_create();
    lv_indev_set_display(mousewheel, disp);
    lv_indev_set_group(mousewheel, group);

    lv_indev_t *kb = lv_sdl_keyboard_create();
    lv_indev_set_display(kb, disp);
    lv_indev_set_group(kb, group);

    return disp;
}

#else

lv_display_t *forgeui_sdl_hal_init(int32_t w, int32_t h)
{
    (void)w;
    (void)h;
    return NULL;
}

#endif
