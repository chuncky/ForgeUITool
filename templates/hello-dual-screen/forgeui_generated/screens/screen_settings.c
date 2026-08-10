#include "screen_settings.h"
#include "../fonts/font_SourceHanSansCN-Bold_16.h"

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
  lv_obj_set_style_text_font(ui_settings, forgeui_font_SourceHanSansCN_Bold_16, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(ui_settings, lv_color_hex(0x243B53), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(ui_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_opa(ui_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_border_opa(ui_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_opa(ui_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_outline_opa(ui_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_image_opa(ui_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  ui_settings_lbl_settings = lv_label_create(ui_settings);
  lv_label_set_text(ui_settings_lbl_settings, "Settings");
  lv_label_set_long_mode(ui_settings_lbl_settings, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(ui_settings_lbl_settings, 24, 24);
  lv_obj_set_size(ui_settings_lbl_settings, 280, 40);
  lv_obj_set_style_text_font(ui_settings_lbl_settings, forgeui_font_SourceHanSansCN_Bold_16, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(ui_settings_lbl_settings, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_opa(ui_settings_lbl_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_border_opa(ui_settings_lbl_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_opa(ui_settings_lbl_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_outline_opa(ui_settings_lbl_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_image_opa(ui_settings_lbl_settings, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(ui_settings_lbl_settings, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(ui_settings_lbl_settings, lv_color_hex(0xF0F4F8), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_align(ui_settings_lbl_settings, LV_TEXT_ALIGN_LEFT, LV_PART_MAIN | LV_STATE_DEFAULT);
  ui_settings_btn_back = lv_button_create(ui_settings);
  {
    lv_obj_t *label = lv_label_create(ui_settings_btn_back);
    lv_label_set_text(label, "Back");
    lv_label_set_long_mode(label, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(label, LV_PCT(100));
    lv_obj_align(label, LV_ALIGN_CENTER, 0, 0);
  }
  lv_obj_set_pos(ui_settings_btn_back, 180, 240);
  lv_obj_set_size(ui_settings_btn_back, 120, 48);
  lv_obj_set_style_text_font(ui_settings_btn_back, forgeui_font_SourceHanSansCN_Bold_16, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(ui_settings_btn_back, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_opa(ui_settings_btn_back, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_border_opa(ui_settings_btn_back, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_opa(ui_settings_btn_back, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_outline_opa(ui_settings_btn_back, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_image_opa(ui_settings_btn_back, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(ui_settings_btn_back, lv_color_hex(0x2196F3), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(ui_settings_btn_back, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_radius(ui_settings_btn_back, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_align(ui_settings_btn_back, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_add_event_cb(ui_settings_btn_back, ui_event_change_screen_home, LV_EVENT_CLICKED, NULL);
}
