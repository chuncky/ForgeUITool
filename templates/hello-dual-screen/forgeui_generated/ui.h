#ifndef FORGEUI_GENERATED_UI_H
#define FORGEUI_GENERATED_UI_H

#ifdef __cplusplus
extern "C" {
#endif

#include "lvgl/lvgl.h"

void screen_home_create(void);
lv_obj_t *screen_home_get(void);
void screen_settings_create(void);
lv_obj_t *screen_settings_get(void);

void ui_event_change_screen_settings(lv_event_t *e);
void ui_event_change_screen_home(lv_event_t *e);
void ui_event_call_on_btn_next(lv_event_t *e);

void ui_init(void);
void ui_nav_load_screen(const char *screen_id);

#ifdef __cplusplus
}
#endif

#endif
