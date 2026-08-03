#include "screen_settings.h"

static lv_obj_t *ui_settings;

lv_obj_t *ui_settings_lbl_settings;
lv_obj_t *ui_settings_btn_back;

lv_obj_t *screen_settings_get(void)
{
    return ui_settings;
}

void screen_settings_create(void)
{
  ui_settings = lv_obj_create(NULL);
  lv_obj_set_size(ui_settings, 480, 320);
  lv_obj_set_style_bg_color(ui_settings, lv_color_hex(0x243B53), 0);
  ui_settings_lbl_settings = lv_label_create(ui_settings);
  lv_label_set_text(ui_settings_lbl_settings, "Settings");
  lv_obj_set_pos(ui_settings_lbl_settings, 24, 24);
  lv_obj_set_size(ui_settings_lbl_settings, 280, 40);
  lv_obj_set_style_text_color(ui_settings_lbl_settings, lv_color_hex(0xF0F4F8), 0);
  ui_settings_btn_back = lv_button_create(ui_settings);
  {
    lv_obj_t *label = lv_label_create(ui_settings_btn_back);
    lv_label_set_text(label, "Back");
    lv_obj_center(label);
  }
  lv_obj_set_pos(ui_settings_btn_back, 180, 240);
  lv_obj_set_size(ui_settings_btn_back, 120, 48);
  lv_obj_add_event_cb(ui_settings_btn_back, ui_event_change_screen_home, LV_EVENT_CLICKED, NULL);
}
