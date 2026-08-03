#include "ui.h"
#include "ui_nav.h"
#include "screens/screen_home.h"
#include "screens/screen_settings.h"
#include "custom/ui_events.h"

void ui_event_change_screen_settings(lv_event_t *e)
{
    LV_UNUSED(e);
    ui_nav_load_screen("settings");
}
void ui_event_change_screen_home(lv_event_t *e)
{
    LV_UNUSED(e);
    ui_nav_load_screen("home");
}

void ui_event_call_on_btn_next(lv_event_t *e)
{
    LV_UNUSED(e);
    on_btn_next();
}

void ui_init(void)
{
    screen_home_create();
    screen_settings_create();
    lv_screen_load(screen_settings_get());
}
