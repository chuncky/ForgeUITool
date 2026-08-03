#include "ui_nav.h"
#include <string.h>
#include "screens/screen_home.h"
#include "screens/screen_settings.h"

void ui_nav_load_screen(const char *screen_id)
{
    if (screen_id == NULL) return;
    if (strcmp(screen_id, "home") == 0) {
        lv_screen_load(screen_home_get());
        return;
    }
    if (strcmp(screen_id, "settings") == 0) {
        lv_screen_load(screen_settings_get());
        return;
    }
}
