#include "screen_home.h"
#include "../fonts/font_SourceHanSansCN-Bold_16.h"

static lv_obj_t *ui_home;

lv_obj_t *ui_home_lbl_title;
lv_obj_t *ui_home_btn_next;

lv_obj_t *screen_home_get(void)
{
    return ui_home;
}

void screen_home_create(void)
{
  ui_home = lv_obj_create(NULL);
  lv_obj_set_size(ui_home, 480, 320);
  lv_obj_set_style_text_font(ui_home, forgeui_font_SourceHanSansCN_Bold_16, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(ui_home, lv_color_hex(0x102A43), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(ui_home, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_opa(ui_home, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_border_opa(ui_home, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_opa(ui_home, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_outline_opa(ui_home, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_image_opa(ui_home, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  ui_home_lbl_title = lv_label_create(ui_home);
  lv_label_set_text(ui_home_lbl_title, "Hello ForgeUI");
  lv_label_set_long_mode(ui_home_lbl_title, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(ui_home_lbl_title, 24, 24);
  lv_obj_set_size(ui_home_lbl_title, 240, 40);
  lv_obj_set_style_text_font(ui_home_lbl_title, forgeui_font_SourceHanSansCN_Bold_16, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(ui_home_lbl_title, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_opa(ui_home_lbl_title, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_border_opa(ui_home_lbl_title, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_opa(ui_home_lbl_title, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_outline_opa(ui_home_lbl_title, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_image_opa(ui_home_lbl_title, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(ui_home_lbl_title, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(ui_home_lbl_title, lv_color_hex(0xF0F4F8), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_align(ui_home_lbl_title, LV_TEXT_ALIGN_LEFT, LV_PART_MAIN | LV_STATE_DEFAULT);
  ui_home_btn_next = lv_button_create(ui_home);
  {
    lv_obj_t *label = lv_label_create(ui_home_btn_next);
    lv_label_set_text(label, "Next");
    lv_label_set_long_mode(label, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(label, LV_PCT(100));
    lv_obj_align(label, LV_ALIGN_CENTER, 0, 0);
  }
  lv_obj_set_pos(ui_home_btn_next, 180, 240);
  lv_obj_set_size(ui_home_btn_next, 120, 48);
  lv_obj_set_style_text_font(ui_home_btn_next, forgeui_font_SourceHanSansCN_Bold_16, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(ui_home_btn_next, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_opa(ui_home_btn_next, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_border_opa(ui_home_btn_next, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_opa(ui_home_btn_next, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_outline_opa(ui_home_btn_next, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_image_opa(ui_home_btn_next, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(ui_home_btn_next, lv_color_hex(0x2196F3), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(ui_home_btn_next, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_radius(ui_home_btn_next, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_set_style_text_align(ui_home_btn_next, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
  lv_obj_add_event_cb(ui_home_btn_next, ui_event_change_screen_settings, LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_home_btn_next, ui_event_call_on_btn_next, LV_EVENT_CLICKED, NULL);
}
