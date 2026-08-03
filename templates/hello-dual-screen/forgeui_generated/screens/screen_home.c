#include "screen_home.h"

static lv_obj_t *ui_home;

lv_obj_t *ui_home_lbl_title;
lv_obj_t *ui_home_btn_next;
lv_obj_t *ui_home_container_1;
lv_obj_t *ui_home_button_1;

lv_obj_t *screen_home_get(void)
{
    return ui_home;
}

void screen_home_create(void)
{
  ui_home = lv_obj_create(NULL);
  lv_obj_set_size(ui_home, 480, 320);
  lv_obj_set_style_bg_color(ui_home, lv_color_hex(0x102A43), 0);
  ui_home_lbl_title = lv_label_create(ui_home);
  lv_label_set_text(ui_home_lbl_title, "Hello ForgeUI");
  lv_obj_set_pos(ui_home_lbl_title, 24, 24);
  lv_obj_set_size(ui_home_lbl_title, 240, 40);
  lv_obj_set_style_text_color(ui_home_lbl_title, lv_color_hex(0xF0F4F8), 0);
  ui_home_btn_next = lv_button_create(ui_home);
  {
    lv_obj_t *label = lv_label_create(ui_home_btn_next);
    lv_label_set_text(label, "Next");
    lv_obj_center(label);
  }
  lv_obj_set_pos(ui_home_btn_next, 180, 240);
  lv_obj_set_size(ui_home_btn_next, 120, 48);
  lv_obj_add_event_cb(ui_home_btn_next, ui_event_change_screen_settings, LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_home_btn_next, ui_event_call_on_btn_next, LV_EVENT_CLICKED, NULL);
  ui_home_container_1 = lv_obj_create(ui_home);
  lv_obj_set_pos(ui_home_container_1, 20, 36);
  lv_obj_set_size(ui_home_container_1, 100, 100);
  lv_obj_set_style_bg_color(ui_home_container_1, lv_color_hex(0x000000), 0);
  ui_home_button_1 = lv_button_create(ui_home_container_1);
  {
    lv_obj_t *label = lv_label_create(ui_home_button_1);
    lv_label_set_text(label, "Button");
    lv_obj_center(label);
  }
  lv_obj_set_pos(ui_home_button_1, 299, 23);
  lv_obj_set_size(ui_home_button_1, 100, 40);
}
