#ifndef FORGE_JSON_RUNTIME_H
#define FORGE_JSON_RUNTIME_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

struct _lv_obj_t;
typedef struct _lv_obj_t lv_obj_t;

#define FORGE_JSON_MAX_ITEMS 12
#define FORGE_JSON_ITEM_LEN 64
#define FORGE_JSON_MAX_FRAMES 8
#define FORGE_JSON_FRAME_LEN 128
#define FORGE_JSON_MAX_KEYMAP_ROWS 6
#define FORGE_JSON_KEYMAP_ROW_LEN 128
#define FORGE_JSON_MAX_CELLS 16
#define FORGE_JSON_MAX_SERIES 4
#define FORGE_JSON_MAX_SERIES_VALUES 16

typedef struct {
    char color[20];
    int value_count;
    int32_t values[FORGE_JSON_MAX_SERIES_VALUES];
} forge_json_chart_series_t;

typedef struct {
    char bg_color[20];
    char text_color[20];
    int16_t bg_opacity;
    int16_t radius;
    char pressed_bg_color[20];
    int16_t pressed_bg_opacity;
} forge_json_subpart_style_t;

typedef struct {
    char bg_color[20];
    char text_color[20];
    int16_t bg_opacity;
    int16_t radius;
} forge_json_state_style_t;

/** Parsed widget descriptor (ForgeUI A2 JSON runtime widget subset). */
typedef struct {
    char type[32];
    int16_t x;
    int16_t y;
    int16_t w;
    int16_t h;
    int16_t frame_rotation;
    char text[128];
    char title[128];
    char keyboard_mode[24];
    int keymap_row_count;
    char keymap_rows[FORGE_JSON_MAX_KEYMAP_ROWS][FORGE_JSON_KEYMAP_ROW_LEN];
    int16_t value;
    int16_t min;
    int16_t max;
    int checked;
    int item_count;
    char items[FORGE_JSON_MAX_ITEMS][FORGE_JSON_ITEM_LEN];
    int16_t arc_length;
    int16_t anim_time;
    int anim_repeat;
    int16_t bright;
    char color[16];
    int16_t visible_row_count;
    int16_t tab_bar_size;
    char tab_bar_position[8];
    int16_t selected_tab_index;
    int16_t col_cnt;
    int16_t row_cnt;
    int16_t point_count;
    int16_t qr_size;
    int16_t today_year;
    int16_t today_month;
    int16_t today_day;
    int cell_count;
    char cells[FORGE_JSON_MAX_CELLS][FORGE_JSON_ITEM_LEN];
    int16_t cell_row[FORGE_JSON_MAX_CELLS];
    int16_t cell_col[FORGE_JSON_MAX_CELLS];
    char text_color[20];
    char bg_color[20];
    char text_align[16];
    char text_font[32];
    char text_decor[16];
    int16_t style_radius;
    int16_t style_border_width;
    char style_border_color[20];
    int16_t style_pad_top;
    int16_t style_pad_right;
    int16_t style_pad_bottom;
    int16_t style_pad_left;
    int16_t style_shadow_width;
    char style_shadow_color[20];
    int16_t style_shadow_ofs_x;
    int16_t style_shadow_ofs_y;
    int16_t style_bg_opacity;
    int16_t style_text_opacity;
    int16_t style_border_opacity;
    int16_t style_shadow_opacity;
    int16_t style_text_letter_space;
    int16_t style_text_line_space;
    int16_t style_clip_corner;
    char style_line_color[20];
    int16_t style_line_width;
    int16_t style_line_opacity;
    int16_t style_outline_width;
    char style_outline_color[20];
    int16_t style_outline_opacity;
    char indicator_bg_color[20];
    int16_t indicator_bg_opacity;
    int16_t indicator_style_radius;
    char indicator_pressed_bg_color[20];
    int16_t indicator_pressed_bg_opacity;
    char knob_bg_color[20];
    int16_t knob_bg_opacity;
    int16_t knob_style_radius;
    char knob_pressed_bg_color[20];
    int16_t knob_pressed_bg_opacity;
    forge_json_subpart_style_t items_style;
    forge_json_subpart_style_t scrollbar_style;
    forge_json_subpart_style_t selected_style;
    forge_json_state_style_t main_checked_style;
    forge_json_state_style_t main_pressed_style;
    forge_json_state_style_t main_focused_style;
    forge_json_state_style_t main_disabled_style;
    forge_json_state_style_t items_checked_style;
    forge_json_state_style_t items_pressed_style;
    forge_json_state_style_t items_focused_style;
    forge_json_state_style_t items_disabled_style;
    forge_json_subpart_style_t cursor_style;
    forge_json_subpart_style_t series_style;
    char image_src[128];
    char image_src_released[128];
    char image_src_pressed[128];
    int frame_count;
    char frames[FORGE_JSON_MAX_FRAMES][FORGE_JSON_FRAME_LEN];
    char layout_type[16];
    int series_count;
    forge_json_chart_series_t series[FORGE_JSON_MAX_SERIES];
} forge_json_widget_desc_t;

/**
 * Parse top-level widgets from ui/screens/{screen_id}.json (no LVGL required).
 * @return 0 on success; negative E_LOADER_* on failure.
 */
int forge_json_runtime_parse_screen(
    const char *package_root,
    const char *screen_id,
    forge_json_widget_desc_t *widgets,
    int max_widgets,
    int *out_count);

#if defined(FORGE_LOADER_WITH_LVGL) && FORGE_LOADER_WITH_LVGL
#include "lvgl.h"
/** Build LVGL screen from A2 JSON (widget subset). */
int forge_json_runtime_load_screen(const char *package_root, const char *screen_id, lv_obj_t **out_screen);
#endif

#ifdef __cplusplus
}
#endif

#endif
