#include "forge_json_runtime.h"
#include "forge_loader.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SCREEN_JSON_MAX 131072
#define PATH_MAX_LOCAL 512
#define WIDGET_OBJ_MAX 8192

static int join_path(char *out, size_t out_len, const char *base, const char *rel)
{
    size_t bl = strlen(base);
    int need_sep = bl > 0 && base[bl - 1] != '/' && base[bl - 1] != '\\';
    int n = snprintf(out, out_len, need_sep ? "%s/%s" : "%s%s", base, rel);
    return n > 0 && (size_t)n < out_len ? 0 : -1;
}

static int read_text_file(const char *path, char *buf, size_t buf_len)
{
    FILE *f = fopen(path, "rb");
    if (!f) return -1;
    size_t n = fread(buf, 1, buf_len - 1, f);
    fclose(f);
    buf[n] = '\0';
    return (int)n;
}

static int read_string_json_field(const char *json, const char *key, char *out, size_t out_len)
{
    char pattern[48];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);
    const char *p = strstr(json, pattern);
    if (!p) return -1;
    p += strlen(pattern);
    while (*p == ' ' || *p == '\t') p++;
    if (*p != '"') return -1;
    p++;
    size_t i = 0;
    while (*p && *p != '"' && i + 1 < out_len) {
        out[i++] = *p++;
    }
    out[i] = '\0';
    return (*p == '"') ? 0 : -1;
}

static int read_json_string_literal(const char *p, char *out, size_t out_len, const char **end_out)
{
    size_t i = 0;

    if (!p || *p != '"') return -1;
    p++;
    while (*p && *p != '"' && i + 1 < out_len) {
        out[i++] = *p++;
    }
    out[i] = '\0';
    if (*p != '"') return -1;
    if (end_out) *end_out = p + 1;
    return 0;
}

static int read_s16_json_field(const char *json, const char *key, int16_t *out)
{
    char pattern[48];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);
    const char *p = strstr(json, pattern);
    if (!p) return -1;
    p += strlen(pattern);
    while (*p == ' ' || *p == '\t') p++;
    int v = 0;
    if (sscanf(p, "%d", &v) != 1) return -1;
    *out = (int16_t)v;
    return 0;
}

static int read_rotation_field(const char *json, int16_t *out_deg)
{
    char pattern[48];
    const char *p;
    float deg = 0.f;

    snprintf(pattern, sizeof(pattern), "\"rotation\":");
    p = strstr(json, pattern);
    if (!p) return -1;
    p += strlen(pattern);
    while (*p == ' ' || *p == '\t') p++;
    if (sscanf(p, "%f", &deg) != 1) return -1;
    if (deg >= 0.f) {
        *out_deg = (int16_t)(deg + 0.5f);
    } else {
        *out_deg = (int16_t)(deg - 0.5f);
    }
    return 0;
}

static int parse_frame_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *frame = strstr(obj, "\"frame\"");
    if (!frame) return -1;
    if (read_s16_json_field(frame, "x", &desc->x) != 0) desc->x = 0;
    if (read_s16_json_field(frame, "y", &desc->y) != 0) desc->y = 0;
    if (read_s16_json_field(frame, "w", &desc->w) != 0) desc->w = 0;
    if (read_s16_json_field(frame, "h", &desc->h) != 0) desc->h = 0;
    desc->frame_rotation = 0;
    read_rotation_field(frame, &desc->frame_rotation);
    return 0;
}

static int read_bool_json_field(const char *json, const char *key, int *out)
{
    char pattern[48];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);
    const char *p = strstr(json, pattern);
    if (!p) return -1;
    p += strlen(pattern);
    while (*p == ' ' || *p == '\t') p++;
    if (strncmp(p, "true", 4) == 0) {
        *out = 1;
        return 0;
    }
    if (strncmp(p, "false", 5) == 0) {
        *out = 0;
        return 0;
    }
    return -1;
}

static void parse_extra_data_items(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *items_key;
    const char *arr_end;
    const char *p;

    desc->item_count = 0;
    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    items_key = strstr(extra, "\"items\"");
    if (!items_key) return;
    arr_end = strchr(items_key, ']');
    if (!arr_end) return;

    p = items_key;
    while (p < arr_end && desc->item_count < FORGE_JSON_MAX_ITEMS) {
        const char *text_key = strstr(p, "\"text\"");
        if (!text_key || text_key >= arr_end) break;
        if (read_string_json_field(text_key, "text", desc->items[desc->item_count],
                                   FORGE_JSON_ITEM_LEN) == 0) {
            desc->item_count++;
        }
        p = text_key + 6;
    }
}

static void parse_extra_data_frames(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *frames_key;
    const char *arr_end;
    const char *p;

    desc->frame_count = 0;
    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    frames_key = strstr(extra, "\"frames\"");
    if (!frames_key) return;
    arr_end = strchr(frames_key, ']');
    if (!arr_end) return;

    p = frames_key;
    while (p < arr_end && desc->frame_count < FORGE_JSON_MAX_FRAMES) {
        const char *src_key = strstr(p, "\"src\"");
        if (!src_key || src_key >= arr_end) break;
        if (read_string_json_field(src_key, "src", desc->frames[desc->frame_count],
                                   sizeof(desc->frames[0])) == 0) {
            desc->frame_count++;
        }
        p = src_key + 5;
    }
}

static void parse_extra_data_keymap(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *rows_key;
    const char *arr_end;
    const char *p;

    desc->keymap_row_count = 0;
    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    rows_key = strstr(extra, "\"rows\"");
    if (!rows_key) return;
    p = strchr(rows_key, '[');
    if (!p) return;
    arr_end = strchr(p, ']');
    if (!arr_end) return;
    p++;
    while (p < arr_end && desc->keymap_row_count < FORGE_JSON_MAX_KEYMAP_ROWS) {
        while (p < arr_end && (*p == ' ' || *p == '\t' || *p == ',' || *p == '\n' || *p == '\r')) {
            p++;
        }
        if (p >= arr_end || *p != '"') break;
        if (read_json_string_literal(p, desc->keymap_rows[desc->keymap_row_count],
                                     sizeof(desc->keymap_rows[0]), &p) == 0) {
            desc->keymap_row_count++;
        } else {
            break;
        }
    }
}

static void parse_extra_data_tabs(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *tabs_key;
    const char *arr_end;
    const char *p;
    int16_t sel = 0;

    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    tabs_key = strstr(extra, "\"tabs\"");
    if (!tabs_key) return;

    desc->item_count = 0;
    arr_end = strchr(tabs_key, ']');
    if (!arr_end) return;

    p = tabs_key;
    while (p < arr_end && desc->item_count < FORGE_JSON_MAX_ITEMS) {
        const char *name_key = strstr(p, "\"name\"");
        if (!name_key || name_key >= arr_end) break;
        if (read_string_json_field(name_key, "name", desc->items[desc->item_count],
                                   FORGE_JSON_ITEM_LEN) == 0) {
            desc->item_count++;
        }
        p = name_key + 6;
    }

    if (read_s16_json_field(extra, "selectedTabIndex", &sel) == 0) {
        desc->selected_tab_index = sel;
    }
}

static void parse_extra_data_buttons(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *buttons_key;
    const char *arr_end;
    const char *p;

    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    buttons_key = strstr(extra, "\"buttons\"");
    if (!buttons_key) return;

    desc->item_count = 0;
    arr_end = strchr(buttons_key, ']');
    if (!arr_end) return;

    p = buttons_key;
    while (p < arr_end && desc->item_count < FORGE_JSON_MAX_ITEMS) {
        const char *text_key = strstr(p, "\"text\"");
        if (!text_key || text_key >= arr_end) break;
        if (read_string_json_field(text_key, "text", desc->items[desc->item_count],
                                   FORGE_JSON_ITEM_LEN) == 0) {
            desc->item_count++;
        }
        p = text_key + 6;
    }
}

static void parse_extra_data_table_cells(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *cells_key;
    const char *p;
    int row = 0;
    int col = 0;

    desc->cell_count = 0;
    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    cells_key = strstr(extra, "\"cells\"");
    if (!cells_key) return;

    p = strchr(cells_key, '[');
    if (!p) return;
    p++;

    while (*p && desc->cell_count < FORGE_JSON_MAX_CELLS) {
        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
        if (*p == ']') {
            p++;
            if (col > 0) {
                row++;
                col = 0;
            }
            continue;
        }
        if (*p == '[') {
            col = 0;
            p++;
            continue;
        }
        if (*p == '"') {
            p++;
            {
                size_t i = 0;
                while (*p && *p != '"' && i + 1 < FORGE_JSON_ITEM_LEN) {
                    desc->cells[desc->cell_count][i++] = *p++;
                }
                desc->cells[desc->cell_count][i] = '\0';
                if (*p == '"') p++;
                desc->cell_row[desc->cell_count] = (int16_t)row;
                desc->cell_col[desc->cell_count] = (int16_t)col;
                desc->cell_count++;
                col++;
            }
            continue;
        }
        p++;
        if (p - cells_key > 4096) break;
    }
}

static void parse_json_int_array(const char *key_pos, int32_t *out, int max_count, int *out_count)
{
    const char *arr;
    const char *p;

    *out_count = 0;
    if (!key_pos || !out || max_count <= 0) return;
    arr = strchr(key_pos, '[');
    if (!arr) return;
    p = arr + 1;
    while (*p && *out_count < max_count) {
        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == ',') p++;
        if (*p == ']') break;
        if (*p == '-' || (*p >= '0' && *p <= '9')) {
            out[*out_count] = (int32_t)strtol(p, (char **)&p, 10);
            (*out_count)++;
        } else {
            p++;
        }
    }
}

static int is_chart_type(const char *type)
{
    return strcmp(type, "chart") == 0 || strcmp(type, "linechart") == 0 ||
           strcmp(type, "barchart") == 0 || strcmp(type, "scatterchart") == 0;
}

static void parse_extra_data_chart_series(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *extra;
    const char *series_key;
    const char *section_end;
    const char *p;

    desc->series_count = 0;
    extra = strstr(obj, "\"extraData\"");
    if (!extra) return;
    series_key = strstr(extra, "\"series\"");
    if (!series_key) return;
    section_end = strchr(series_key, ']');
    if (!section_end) return;

    p = series_key;
    while (p < section_end && desc->series_count < FORGE_JSON_MAX_SERIES) {
        const char *obj_start = strchr(p, '{');
        const char *obj_end;
        char ser_chunk[512];
        size_t len;
        int depth;
        forge_json_chart_series_t *ser;

        if (!obj_start || obj_start >= section_end) break;
        obj_end = obj_start + 1;
        depth = 1;
        while (*obj_end && depth > 0) {
            if (*obj_end == '{') depth++;
            else if (*obj_end == '}') depth--;
            obj_end++;
        }
        len = (size_t)(obj_end - obj_start);
        if (len >= sizeof(ser_chunk)) len = sizeof(ser_chunk) - 1;
        memcpy(ser_chunk, obj_start, len);
        ser_chunk[len] = '\0';

        ser = &desc->series[desc->series_count];
        ser->value_count = 0;
        read_string_json_field(ser_chunk, "color", ser->color, sizeof(ser->color));
        parse_json_int_array(strstr(ser_chunk, "\"values\""), ser->values,
                             FORGE_JSON_MAX_SERIES_VALUES, &ser->value_count);
        desc->series_count++;
        p = obj_end;
    }
}

static void parse_props_block(const char *props, forge_json_widget_desc_t *desc)
{
    const char *range;

    if (!props) return;
    read_string_json_field(props, "text", desc->text, sizeof(desc->text));
    read_string_json_field(props, "title", desc->title, sizeof(desc->title));
    if (read_string_json_field(props, "mode", desc->keyboard_mode, sizeof(desc->keyboard_mode)) != 0) {
        strncpy(desc->keyboard_mode, "TEXT_LOWER", sizeof(desc->keyboard_mode) - 1);
        desc->keyboard_mode[sizeof(desc->keyboard_mode) - 1] = '\0';
    }
    if (read_s16_json_field(props, "value", &desc->value) != 0) desc->value = 0;
    desc->min = 0;
    desc->max = 100;
    range = strstr(props, "\"range\"");
    if (range) {
        read_s16_json_field(range, "min", &desc->min);
        read_s16_json_field(range, "max", &desc->max);
    } else {
        read_s16_json_field(props, "min", &desc->min);
        read_s16_json_field(props, "max", &desc->max);
    }
    if (read_bool_json_field(props, "checked", &desc->checked) != 0) {
        desc->checked = 0;
    }
    if (read_s16_json_field(props, "arc_length", &desc->arc_length) != 0) {
        desc->arc_length = 60;
    }
    if (read_s16_json_field(props, "duration", &desc->anim_time) != 0 &&
        read_s16_json_field(props, "anim_time", &desc->anim_time) != 0) {
        desc->anim_time = 1000;
    }
    if (read_bool_json_field(props, "repeat", &desc->anim_repeat) != 0) {
        desc->anim_repeat = 1;
    }
    if (read_s16_json_field(props, "bright", &desc->bright) != 0) {
        desc->bright = 255;
    }
    if (read_string_json_field(props, "color", desc->color, sizeof(desc->color)) != 0) {
        desc->color[0] = '\0';
    }
    if (read_s16_json_field(props, "visible_row_count", &desc->visible_row_count) != 0) {
        desc->visible_row_count = 3;
    }
    if (read_s16_json_field(props, "tab_bar_size", &desc->tab_bar_size) != 0) {
        desc->tab_bar_size = 40;
    }
    if (read_string_json_field(props, "tab_bar_position", desc->tab_bar_position,
                               sizeof(desc->tab_bar_position)) != 0) {
        strncpy(desc->tab_bar_position, "TOP", sizeof(desc->tab_bar_position) - 1);
        desc->tab_bar_position[sizeof(desc->tab_bar_position) - 1] = '\0';
    }
    if (read_s16_json_field(props, "col_cnt", &desc->col_cnt) != 0) {
        desc->col_cnt = 3;
    }
    if (read_s16_json_field(props, "row_cnt", &desc->row_cnt) != 0) {
        desc->row_cnt = 3;
    }
    if (read_s16_json_field(props, "point_count", &desc->point_count) != 0) {
        desc->point_count = 10;
    }
}

static void parse_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *style;
    const char *main;
    const char *def;
    const char *parts;

    if (!obj) return;
    style = strstr(obj, "\"style\"");
    if (!style) return;

    main = strstr(style, "\"main\"");
    if (!main) {
        parts = strstr(style, "\"parts\"");
        if (parts) {
            main = strstr(parts, "\"main\"");
        }
    }
    if (!main) return;

    def = strstr(main, "\"default\"");
    if (!def) return;

    read_string_json_field(def, "text_color", desc->text_color, sizeof(desc->text_color));
    read_string_json_field(def, "bg_color", desc->bg_color, sizeof(desc->bg_color));
    read_string_json_field(def, "text_align", desc->text_align, sizeof(desc->text_align));
    read_string_json_field(def, "text_font", desc->text_font, sizeof(desc->text_font));
    read_string_json_field(def, "text_decor", desc->text_decor, sizeof(desc->text_decor));
    read_string_json_field(def, "bg_image", desc->image_src, sizeof(desc->image_src));
    read_string_json_field(def, "bg_image_src", desc->image_src, sizeof(desc->image_src));
    if (read_s16_json_field(def, "radius", &desc->style_radius) != 0) {
        desc->style_radius = -1;
    }
    if (read_s16_json_field(def, "border_width", &desc->style_border_width) != 0) {
        desc->style_border_width = -1;
    }
    read_string_json_field(def, "border_color", desc->style_border_color, sizeof(desc->style_border_color));
    if (read_s16_json_field(def, "pad_top", &desc->style_pad_top) != 0) {
        desc->style_pad_top = -1;
    }
    if (read_s16_json_field(def, "pad_right", &desc->style_pad_right) != 0) {
        desc->style_pad_right = -1;
    }
    if (read_s16_json_field(def, "pad_bottom", &desc->style_pad_bottom) != 0) {
        desc->style_pad_bottom = -1;
    }
    if (read_s16_json_field(def, "pad_left", &desc->style_pad_left) != 0) {
        desc->style_pad_left = -1;
    }
    if (read_s16_json_field(def, "shadow_width", &desc->style_shadow_width) != 0) {
        desc->style_shadow_width = -1;
    }
    read_string_json_field(def, "shadow_color", desc->style_shadow_color, sizeof(desc->style_shadow_color));
    if (read_s16_json_field(def, "shadow_ofs_x", &desc->style_shadow_ofs_x) != 0) {
        desc->style_shadow_ofs_x = -1;
    }
    if (read_s16_json_field(def, "shadow_ofs_y", &desc->style_shadow_ofs_y) != 0) {
        desc->style_shadow_ofs_y = -1;
    }
    if (read_s16_json_field(def, "bg_opacity", &desc->style_bg_opacity) != 0) {
        desc->style_bg_opacity = -1;
    }
    if (read_s16_json_field(def, "text_opacity", &desc->style_text_opacity) != 0) {
        desc->style_text_opacity = -1;
    }
    if (read_s16_json_field(def, "border_opacity", &desc->style_border_opacity) != 0) {
        desc->style_border_opacity = -1;
    }
    if (read_s16_json_field(def, "shadow_opacity", &desc->style_shadow_opacity) != 0) {
        desc->style_shadow_opacity = -1;
    }
    if (read_s16_json_field(def, "text_letter_space", &desc->style_text_letter_space) != 0) {
        desc->style_text_letter_space = -1;
    }
    if (read_s16_json_field(def, "text_line_space", &desc->style_text_line_space) != 0) {
        desc->style_text_line_space = -1;
    }
    {
        int clip = 0;
        if (read_bool_json_field(def, "clip_corner", &clip) == 0) {
            desc->style_clip_corner = clip ? 1 : 0;
        }
    }
    read_string_json_field(def, "line_color", desc->style_line_color, sizeof(desc->style_line_color));
    if (read_s16_json_field(def, "line_width", &desc->style_line_width) != 0) {
        desc->style_line_width = -1;
    }
    if (read_s16_json_field(def, "line_opacity", &desc->style_line_opacity) != 0) {
        desc->style_line_opacity = -1;
    }
    if (read_s16_json_field(def, "outline_width", &desc->style_outline_width) != 0) {
        desc->style_outline_width = -1;
    }
    read_string_json_field(def, "outline_color", desc->style_outline_color, sizeof(desc->style_outline_color));
    if (read_s16_json_field(def, "outline_opacity", &desc->style_outline_opacity) != 0) {
        desc->style_outline_opacity = -1;
    }
}

static void parse_indicator_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *style;
    const char *indicator;
    const char *def;
    const char *pressed;

    if (!obj) return;
    style = strstr(obj, "\"style\"");
    if (!style) return;
    indicator = strstr(style, "\"indicator\"");
    if (!indicator) return;

    def = strstr(indicator, "\"default\"");
    if (def) {
        read_string_json_field(def, "bg_color", desc->indicator_bg_color, sizeof(desc->indicator_bg_color));
        if (read_s16_json_field(def, "bg_opacity", &desc->indicator_bg_opacity) != 0) {
            desc->indicator_bg_opacity = -1;
        }
        if (read_s16_json_field(def, "radius", &desc->indicator_style_radius) != 0) {
            desc->indicator_style_radius = -1;
        }
    }

    pressed = strstr(indicator, "\"pressed\"");
    if (pressed) {
        read_string_json_field(pressed, "bg_color", desc->indicator_pressed_bg_color,
                               sizeof(desc->indicator_pressed_bg_color));
        if (read_s16_json_field(pressed, "bg_opacity", &desc->indicator_pressed_bg_opacity) != 0) {
            desc->indicator_pressed_bg_opacity = -1;
        }
    }
}

static void parse_knob_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *style;
    const char *knob;
    const char *def;
    const char *pressed;

    if (!obj) return;
    style = strstr(obj, "\"style\"");
    if (!style) return;
    knob = strstr(style, "\"knob\"");
    if (!knob) return;

    def = strstr(knob, "\"default\"");
    if (def) {
        read_string_json_field(def, "bg_color", desc->knob_bg_color, sizeof(desc->knob_bg_color));
        if (read_s16_json_field(def, "bg_opacity", &desc->knob_bg_opacity) != 0) {
            desc->knob_bg_opacity = -1;
        }
        if (read_s16_json_field(def, "radius", &desc->knob_style_radius) != 0) {
            desc->knob_style_radius = -1;
        }
    }

    pressed = strstr(knob, "\"pressed\"");
    if (pressed) {
        read_string_json_field(pressed, "bg_color", desc->knob_pressed_bg_color,
                               sizeof(desc->knob_pressed_bg_color));
        if (read_s16_json_field(pressed, "bg_opacity", &desc->knob_pressed_bg_opacity) != 0) {
            desc->knob_pressed_bg_opacity = -1;
        }
    }
}

static void init_subpart_style(forge_json_subpart_style_t *style)
{
    style->bg_opacity = -1;
    style->radius = -1;
    style->pressed_bg_opacity = -1;
    style->bg_color[0] = '\0';
    style->text_color[0] = '\0';
    style->pressed_bg_color[0] = '\0';
}

static const char *find_named_style_part(const char *style, const char * const names[], size_t count)
{
    size_t i;

    if (!style) return NULL;
    for (i = 0; i < count; i++) {
        const char *part = strstr(style, names[i]);
        if (part) return part;
    }
    return NULL;
}

static void parse_subpart_style_block(const char *part, forge_json_subpart_style_t *style, int parse_pressed)
{
    const char *def;
    const char *pressed;

    if (!part || !style) return;

    def = strstr(part, "\"default\"");
    if (def) {
        read_string_json_field(def, "bg_color", style->bg_color, sizeof(style->bg_color));
        read_string_json_field(def, "text_color", style->text_color, sizeof(style->text_color));
        if (read_s16_json_field(def, "bg_opacity", &style->bg_opacity) != 0) {
            style->bg_opacity = -1;
        }
        if (read_s16_json_field(def, "radius", &style->radius) != 0) {
            style->radius = -1;
        }
    }

    if (!parse_pressed) return;
    pressed = strstr(part, "\"pressed\"");
    if (pressed) {
        read_string_json_field(pressed, "bg_color", style->pressed_bg_color, sizeof(style->pressed_bg_color));
        if (read_s16_json_field(pressed, "bg_opacity", &style->pressed_bg_opacity) != 0) {
            style->pressed_bg_opacity = -1;
        }
    }
}

static void parse_items_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    static const char * const k_items_parts[] = {
        "\"items\"",
        "\"main_list\"",
        "\"main_item\"",
        "\"selected_list\"",
        "\"main_tabbaritem\"",
        "\"items_buttonmatrix\"",
    };
    const char *style;
    const char *part;

    init_subpart_style(&desc->items_style);
    style = strstr(obj, "\"style\"");
    part = find_named_style_part(style, k_items_parts,
                                 sizeof(k_items_parts) / sizeof(k_items_parts[0]));
    parse_subpart_style_block(part, &desc->items_style, 1);
}

static void parse_scrollbar_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    static const char * const k_scrollbar_parts[] = {
        "\"scrollbar\"",
        "\"scrollbar_list\"",
    };
    const char *style;
    const char *part;

    init_subpart_style(&desc->scrollbar_style);
    style = strstr(obj, "\"style\"");
    part = find_named_style_part(style, k_scrollbar_parts,
                                 sizeof(k_scrollbar_parts) / sizeof(k_scrollbar_parts[0]));
    parse_subpart_style_block(part, &desc->scrollbar_style, 0);
}

static void init_state_style(forge_json_state_style_t *style)
{
    style->bg_opacity = -1;
    style->radius = -1;
    style->bg_color[0] = '\0';
    style->text_color[0] = '\0';
}

static void parse_state_style_block(const char *state, forge_json_state_style_t *style)
{
    if (!state || !style) return;

    read_string_json_field(state, "bg_color", style->bg_color, sizeof(style->bg_color));
    read_string_json_field(state, "text_color", style->text_color, sizeof(style->text_color));
    if (read_s16_json_field(state, "bg_opacity", &style->bg_opacity) != 0) {
        style->bg_opacity = -1;
    }
    if (read_s16_json_field(state, "radius", &style->radius) != 0) {
        style->radius = -1;
    }
}

static void parse_selected_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *style;
    const char *part;

    init_subpart_style(&desc->selected_style);
    style = strstr(obj, "\"style\"");
    part = style ? strstr(style, "\"selected\"") : NULL;
    parse_subpart_style_block(part, &desc->selected_style, 0);
}

static void parse_part_state_styles(
    const char *part,
    forge_json_state_style_t *checked,
    forge_json_state_style_t *pressed,
    forge_json_state_style_t *focused,
    forge_json_state_style_t *disabled)
{
    const char *block;

    if (!part) return;
    block = strstr(part, "\"checked\"");
    if (block && checked) parse_state_style_block(block, checked);
    block = strstr(part, "\"pressed\"");
    if (block && pressed) parse_state_style_block(block, pressed);
    block = strstr(part, "\"focused\"");
    if (block && focused) parse_state_style_block(block, focused);
    block = strstr(part, "\"disabled\"");
    if (block && disabled) parse_state_style_block(block, disabled);
}

static void parse_checked_style_blocks(const char *obj, forge_json_widget_desc_t *desc)
{
    static const char * const k_items_parts[] = {
        "\"items\"",
        "\"main_list\"",
        "\"main_item\"",
        "\"selected_list\"",
        "\"main_tabbaritem\"",
        "\"items_buttonmatrix\"",
    };
    const char *style;
    const char *main;
    const char *items;

    init_state_style(&desc->main_checked_style);
    init_state_style(&desc->main_pressed_style);
    init_state_style(&desc->main_focused_style);
    init_state_style(&desc->main_disabled_style);
    init_state_style(&desc->items_checked_style);
    init_state_style(&desc->items_pressed_style);
    init_state_style(&desc->items_focused_style);
    init_state_style(&desc->items_disabled_style);

    style = strstr(obj, "\"style\"");
    if (!style) return;

    main = strstr(style, "\"main\"");
    parse_part_state_styles(main, &desc->main_checked_style, &desc->main_pressed_style,
                            &desc->main_focused_style, &desc->main_disabled_style);

    items = find_named_style_part(style, k_items_parts,
                                  sizeof(k_items_parts) / sizeof(k_items_parts[0]));
    parse_part_state_styles(items, &desc->items_checked_style, &desc->items_pressed_style,
                            &desc->items_focused_style, &desc->items_disabled_style);
}

static void parse_cursor_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *style;
    const char *part;

    init_subpart_style(&desc->cursor_style);
    style = strstr(obj, "\"style\"");
    part = style ? strstr(style, "\"cursor\"") : NULL;
    parse_subpart_style_block(part, &desc->cursor_style, 1);
}

static void parse_series_style_block(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *style;
    const char *part;

    init_subpart_style(&desc->series_style);
    style = strstr(obj, "\"style\"");
    part = style ? strstr(style, "\"series\"") : NULL;
    parse_subpart_style_block(part, &desc->series_style, 0);
}

static void parse_type_props(const char *props, const char *type, forge_json_widget_desc_t *desc)
{
    if (!props || !type) return;
    if (strcmp(type, "digitalclock") == 0) {
        read_string_json_field(props, "initial_time", desc->text, sizeof(desc->text));
    } else if (strcmp(type, "qrcode") == 0) {
        read_string_json_field(props, "qr_data", desc->text, sizeof(desc->text));
        if (read_s16_json_field(props, "qr_size", &desc->qr_size) != 0) {
            desc->qr_size = 80;
        }
    } else if (strcmp(type, "barcode") == 0) {
        read_string_json_field(props, "barcode_data", desc->text, sizeof(desc->text));
    } else if (strcmp(type, "calendar") == 0) {
        if (read_s16_json_field(props, "today_year", &desc->today_year) != 0) {
            desc->today_year = 2026;
        }
        if (read_s16_json_field(props, "today_month", &desc->today_month) != 0) {
            desc->today_month = 8;
        }
        if (read_s16_json_field(props, "today_day", &desc->today_day) != 0) {
            desc->today_day = 1;
        }
    } else if (strcmp(type, "image") == 0) {
        read_string_json_field(props, "src", desc->image_src, sizeof(desc->image_src));
    } else if (strcmp(type, "imagebutton") == 0) {
        read_string_json_field(props, "src_released", desc->image_src_released,
                               sizeof(desc->image_src_released));
        read_string_json_field(props, "src_pressed", desc->image_src_pressed,
                               sizeof(desc->image_src_pressed));
    } else if (strcmp(type, "container") == 0) {
        if (read_string_json_field(props, "layout_type", desc->layout_type, sizeof(desc->layout_type)) != 0) {
            strncpy(desc->layout_type, "none", sizeof(desc->layout_type) - 1);
            desc->layout_type[sizeof(desc->layout_type) - 1] = '\0';
        }
    }
}

static int parse_widget_object(const char *obj, forge_json_widget_desc_t *desc)
{
    const char *props;

    memset(desc, 0, sizeof(*desc));
    desc->max = 100;
    desc->arc_length = 60;
    desc->anim_time = 1000;
    desc->anim_repeat = 1;
    desc->bright = 255;
    desc->visible_row_count = 3;
    desc->tab_bar_size = 40;
    desc->col_cnt = 3;
    desc->row_cnt = 3;
    desc->point_count = 10;
    desc->style_radius = -1;
    desc->style_border_width = -1;
    desc->style_pad_top = -1;
    desc->style_pad_right = -1;
    desc->style_pad_bottom = -1;
    desc->style_pad_left = -1;
    desc->style_shadow_width = -1;
    desc->style_shadow_ofs_x = -1;
    desc->style_shadow_ofs_y = -1;
    desc->style_bg_opacity = -1;
    desc->style_text_opacity = -1;
    desc->style_border_opacity = -1;
    desc->style_shadow_opacity = -1;
    desc->style_text_letter_space = -1;
    desc->style_text_line_space = -1;
    desc->style_clip_corner = -1;
    desc->style_line_width = -1;
    desc->style_line_opacity = -1;
    desc->style_outline_width = -1;
    desc->style_outline_opacity = -1;
    desc->indicator_bg_opacity = -1;
    desc->indicator_style_radius = -1;
    desc->indicator_pressed_bg_opacity = -1;
    desc->knob_bg_opacity = -1;
    desc->knob_style_radius = -1;
    desc->knob_pressed_bg_opacity = -1;
    strncpy(desc->layout_type, "none", sizeof(desc->layout_type) - 1);
    strncpy(desc->tab_bar_position, "TOP", sizeof(desc->tab_bar_position) - 1);
    if (read_string_json_field(obj, "type", desc->type, sizeof(desc->type)) != 0) {
        return -1;
    }
    if (parse_frame_block(obj, desc) != 0) {
        return -1;
    }
    props = strstr(obj, "\"props\"");
    parse_props_block(props, desc);
    parse_type_props(props, desc->type, desc);
    parse_extra_data_items(obj, desc);
    if (strcmp(desc->type, "tabview") == 0) {
        parse_extra_data_tabs(obj, desc);
    } else if (strcmp(desc->type, "msgbox") == 0) {
        parse_extra_data_buttons(obj, desc);
    } else if (strcmp(desc->type, "table") == 0) {
        parse_extra_data_table_cells(obj, desc);
    } else if (is_chart_type(desc->type)) {
        parse_extra_data_chart_series(obj, desc);
    } else if (strcmp(desc->type, "animimg") == 0) {
        parse_extra_data_frames(obj, desc);
    } else if (strcmp(desc->type, "keyboard") == 0) {
        parse_extra_data_keymap(obj, desc);
    }
    parse_style_block(obj, desc);
    parse_indicator_style_block(obj, desc);
    parse_knob_style_block(obj, desc);
    parse_items_style_block(obj, desc);
    parse_scrollbar_style_block(obj, desc);
    parse_selected_style_block(obj, desc);
    parse_checked_style_blocks(obj, desc);
    parse_cursor_style_block(obj, desc);
    parse_series_style_block(obj, desc);
    if (desc->item_count == 0 && props) {
        char opts[256];
        if (read_string_json_field(props, "options", opts, sizeof(opts)) == 0 && opts[0]) {
            /* dropdown props.options — split on \n into items */
            char *tok = opts;
            char *next;
            while (desc->item_count < FORGE_JSON_MAX_ITEMS && tok && *tok) {
                next = strchr(tok, '\n');
                if (next) *next = '\0';
                strncpy(desc->items[desc->item_count], tok, FORGE_JSON_ITEM_LEN - 1);
                desc->items[desc->item_count][FORGE_JSON_ITEM_LEN - 1] = '\0';
                desc->item_count++;
                tok = next ? next + 1 : NULL;
            }
        }
    }
    return 0;
}

static int is_json_container(const char *type)
{
    return strcmp(type, "container") == 0 || strcmp(type, "tabview") == 0 ||
           strcmp(type, "tileview") == 0 || strcmp(type, "win") == 0 ||
           strcmp(type, "menu") == 0;
}

static int is_supported_widget(const char *type)
{
    return strcmp(type, "label") == 0 || strcmp(type, "button") == 0 ||
           strcmp(type, "container") == 0 || strcmp(type, "slider") == 0 ||
           strcmp(type, "switch") == 0 || strcmp(type, "image") == 0 ||
           strcmp(type, "imagebutton") == 0 || strcmp(type, "animimg") == 0 ||
           strcmp(type, "tabview") == 0 || strcmp(type, "buttonmatrix") == 0 ||
           strcmp(type, "keyboard") == 0 || strcmp(type, "msgbox") == 0 ||
           strcmp(type, "table") == 0 || strcmp(type, "chart") == 0 ||
           strcmp(type, "linechart") == 0 || strcmp(type, "barchart") == 0 ||
           strcmp(type, "scatterchart") == 0 ||
           strcmp(type, "spinbox") == 0 || strcmp(type, "canvas") == 0 ||
           strcmp(type, "qrcode") == 0 || strcmp(type, "barcode") == 0 ||
           strcmp(type, "digitalclock") == 0 || strcmp(type, "tileview") == 0 ||
           strcmp(type, "win") == 0 || strcmp(type, "menu") == 0 ||
           strcmp(type, "spangroup") == 0 || strcmp(type, "scale") == 0 ||
           strcmp(type, "calendar") == 0 ||
           strcmp(type, "checkbox") == 0 || strcmp(type, "bar") == 0 ||
           strcmp(type, "dropdown") == 0 || strcmp(type, "list") == 0 ||
           strcmp(type, "led") == 0 || strcmp(type, "spinner") == 0 ||
           strcmp(type, "roller") == 0 || strcmp(type, "arc") == 0 ||
           strcmp(type, "textarea") == 0 || strcmp(type, "line") == 0;
}

static const char *find_children_array(const char *obj)
{
    const char *children = strstr(obj, "\"children\"");
    if (!children) return NULL;
    return strchr(children, '[');
}

static int scan_children_array(
    const char *arr,
    forge_json_widget_desc_t *widgets,
    int max_widgets,
    int *count,
    int recursive)
{
    const char *p;

    if (!arr || *arr != '[') return E_LOADER_FMT;
    p = arr + 1;

    while (*p) {
        char chunk[WIDGET_OBJ_MAX];
        const char *start;
        const char *child_arr;
        size_t len;
        int depth;
        forge_json_widget_desc_t desc;

        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
        if (*p == ']') break;
        if (*p != '{') return E_LOADER_FMT;

        start = p;
        depth = 0;
        do {
            if (*p == '{') depth++;
            else if (*p == '}') depth--;
            p++;
        } while (*p && depth > 0);
        if (depth != 0) return E_LOADER_FMT;

        len = (size_t)(p - start);
        if (len >= sizeof(chunk)) len = sizeof(chunk) - 1;
        memcpy(chunk, start, len);
        chunk[len] = '\0';

        if (parse_widget_object(chunk, &desc) != 0) {
            return E_LOADER_FMT;
        }
        if (is_supported_widget(desc.type)) {
            if (*count >= max_widgets) return E_LOADER_FMT;
            widgets[(*count)++] = desc;
        }
        if (recursive && is_json_container(desc.type)) {
            child_arr = find_children_array(chunk);
            if (child_arr) {
                int rc = scan_children_array(child_arr, widgets, max_widgets, count, 1);
                if (rc != E_LOADER_OK) return rc;
            }
        }
    }

    return E_LOADER_OK;
}

static int scan_top_level_widgets(const char *json, forge_json_widget_desc_t *widgets, int max_widgets, int *out_count)
{
    const char *arr = find_children_array(json);
    int count = 0;
    int rc;

    if (!arr) {
        *out_count = 0;
        return E_LOADER_OK;
    }
    rc = scan_children_array(arr, widgets, max_widgets, &count, 1);
    if (rc != E_LOADER_OK) return rc;
    *out_count = count;
    return E_LOADER_OK;
}

static int load_screen_json(const char *package_root, const char *screen_id, char *buf, size_t buf_len)
{
    char rel[96];
    char path[PATH_MAX_LOCAL];

    if (!package_root || !screen_id || screen_id[0] == '\0') return E_LOADER_FMT;
    snprintf(rel, sizeof(rel), "ui/screens/%s.json", screen_id);
    if (join_path(path, sizeof(path), package_root, rel) != 0) return E_LOADER_FMT;
    if (read_text_file(path, buf, buf_len) < 0) return E_LOADER_FMT;
    return E_LOADER_OK;
}

int forge_json_runtime_parse_screen(
    const char *package_root,
    const char *screen_id,
    forge_json_widget_desc_t *widgets,
    int max_widgets,
    int *out_count)
{
    char *json;

    if (!package_root || !screen_id || !widgets || max_widgets <= 0 || !out_count) {
        return E_LOADER_FMT;
    }

    json = (char *)malloc(SCREEN_JSON_MAX);
    if (!json) return E_LOADER_FMT;

    if (load_screen_json(package_root, screen_id, json, SCREEN_JSON_MAX) != E_LOADER_OK) {
        free(json);
        return E_LOADER_FMT;
    }

    {
        int rc = scan_top_level_widgets(json, widgets, max_widgets, out_count);
        free(json);
        return rc;
    }
}

#if defined(FORGE_LOADER_WITH_LVGL) && FORGE_LOADER_WITH_LVGL

static uint32_t color_to_hex(const char *color)
{
    const char *p = color;
    char hex[7];
    size_t i;

    if (!p || !p[0]) return 0x00FF00;
    while (*p == '#' || *p == ' ') p++;
    for (i = 0; i < 6 && p[i]; i++) {
        hex[i] = p[i];
    }
    hex[i] = '\0';
    if (i < 6) return 0x00FF00;
    return (uint32_t)strtoul(hex, NULL, 16);
}

static lv_text_align_t text_align_from_string(const char *align)
{
    if (!align || !align[0]) return LV_TEXT_ALIGN_LEFT;
    if (strcmp(align, "center") == 0) return LV_TEXT_ALIGN_CENTER;
    if (strcmp(align, "right") == 0) return LV_TEXT_ALIGN_RIGHT;
    if (strcmp(align, "auto") == 0) return LV_TEXT_ALIGN_AUTO;
    return LV_TEXT_ALIGN_LEFT;
}

static lv_text_decor_t text_decor_from_string(const char *decor)
{
    if (!decor || !decor[0]) return LV_TEXT_DECOR_NONE;
    if (strcmp(decor, "underline") == 0) return LV_TEXT_DECOR_UNDERLINE;
    if (strcmp(decor, "strikethrough") == 0) return LV_TEXT_DECOR_STRIKETHROUGH;
    return LV_TEXT_DECOR_NONE;
}

static lv_keyboard_mode_t keyboard_mode_from_string(const char *mode)
{
    if (!mode || !mode[0]) return LV_KEYBOARD_MODE_TEXT_LOWER;
    if (strcmp(mode, "TEXT_UPPER") == 0) return LV_KEYBOARD_MODE_TEXT_UPPER;
    if (strcmp(mode, "NUMBER") == 0) return LV_KEYBOARD_MODE_NUMBER;
    if (strcmp(mode, "SPECIAL") == 0) return LV_KEYBOARD_MODE_SPECIAL;
    return LV_KEYBOARD_MODE_TEXT_LOWER;
}

static const char *keyboard_map_token(const char *tok)
{
    if (strcmp(tok, "LV_SYMBOL_OK") == 0) return LV_SYMBOL_OK;
    if (strcmp(tok, "LV_SYMBOL_CLOSE") == 0) return LV_SYMBOL_CLOSE;
    if (strcmp(tok, "LV_SYMBOL_BACKSPACE") == 0) return LV_SYMBOL_BACKSPACE;
    if (strcmp(tok, "LV_SYMBOL_NEW_LINE") == 0) return LV_SYMBOL_NEW_LINE;
    if (strcmp(tok, "LV_SYMBOL_LEFT") == 0) return LV_SYMBOL_LEFT;
    if (strcmp(tok, "LV_SYMBOL_RIGHT") == 0) return LV_SYMBOL_RIGHT;
    if (strcmp(tok, "LV_SYMBOL_PLUS") == 0) return LV_SYMBOL_PLUS;
    if (strcmp(tok, "LV_SYMBOL_MINUS") == 0) return LV_SYMBOL_MINUS;
    return tok;
}

static void apply_keyboard_keymap(lv_obj_t *obj, forge_json_widget_desc_t *desc)
{
    const char *map[FORGE_JSON_MAX_ITEMS + FORGE_JSON_MAX_KEYMAP_ROWS + 2];
    lv_buttonmatrix_ctrl_t ctrl[FORGE_JSON_MAX_ITEMS];
    int map_len = 0;
    int btn = 0;
    int key_idx = 0;
    int row;

    if (!obj || desc->keymap_row_count <= 0) return;

    for (row = 0; row < desc->keymap_row_count; row++) {
        const char *p = desc->keymap_rows[row];
        if (row > 0) map[map_len++] = "\n";
        while (*p) {
            char tok[FORGE_JSON_ITEM_LEN];
            size_t i = 0;
            while (*p == ' ' || *p == '\t') p++;
            if (!*p) break;
            while (*p && *p != ' ' && *p != '\t' && i + 1 < sizeof(tok)) {
                tok[i++] = *p++;
            }
            tok[i] = '\0';
            if (!tok[0] || key_idx >= FORGE_JSON_MAX_ITEMS) continue;
            strncpy(desc->items[key_idx], tok, FORGE_JSON_ITEM_LEN - 1);
            desc->items[key_idx][FORGE_JSON_ITEM_LEN - 1] = '\0';
            map[map_len++] = keyboard_map_token(desc->items[key_idx]);
            ctrl[btn++] = LV_KEYBOARD_CTRL_BUTTON_FLAGS;
            key_idx++;
        }
    }
    map[map_len++] = "";
    desc->item_count = key_idx;
    lv_keyboard_set_map(obj, keyboard_mode_from_string(desc->keyboard_mode), map, ctrl);
}

static void apply_frame_rotation(lv_obj_t *obj, int16_t degrees)
{
    int norm;
    const lv_style_selector_t sel = LV_PART_MAIN | LV_STATE_DEFAULT;

    if (!obj || degrees == 0) return;
    norm = degrees % 360;
    if (norm < 0) norm += 360;
    if (norm == 0) return;
    lv_obj_set_style_transform_pivot_x(obj, lv_pct(50), sel);
    lv_obj_set_style_transform_pivot_y(obj, lv_pct(50), sel);
    lv_obj_set_style_transform_rotation(obj, norm * 10, sel);
}

static void apply_container_layout(lv_obj_t *obj, const char *layout_type)
{
    if (!obj || !layout_type || !layout_type[0]) return;
    if (strcmp(layout_type, "flex_row") == 0) {
        lv_obj_set_layout(obj, LV_LAYOUT_FLEX);
        lv_obj_set_flex_flow(obj, LV_FLEX_FLOW_ROW);
    } else if (strcmp(layout_type, "flex_column") == 0) {
        lv_obj_set_layout(obj, LV_LAYOUT_FLEX);
        lv_obj_set_flex_flow(obj, LV_FLEX_FLOW_COLUMN);
    } else if (strcmp(layout_type, "grid") == 0) {
        /* Shared FR(1) 2×2 template; pointers must remain valid for object lifetime. */
        static lv_coord_t col_dsc[] = {LV_GRID_FR(1), LV_GRID_FR(1), LV_GRID_TEMPLATE_LAST};
        static lv_coord_t row_dsc[] = {LV_GRID_FR(1), LV_GRID_FR(1), LV_GRID_TEMPLATE_LAST};
        lv_obj_set_layout(obj, LV_LAYOUT_GRID);
        lv_obj_set_grid_dsc_array(obj, col_dsc, row_dsc);
    }
}

static void apply_main_default_style(lv_obj_t *obj, const forge_json_widget_desc_t *desc)
{
    const lv_style_selector_t sel = LV_PART_MAIN | LV_STATE_DEFAULT;

    if (desc->text_color[0]) {
        lv_obj_set_style_text_color(obj, lv_color_hex(color_to_hex(desc->text_color)), sel);
    }
    if (desc->bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(desc->bg_color)), sel);
    }
    if (desc->text_align[0]) {
        lv_obj_set_style_text_align(obj, text_align_from_string(desc->text_align), sel);
    }
    if (desc->text_decor[0]) {
        lv_obj_set_style_text_decor(obj, text_decor_from_string(desc->text_decor), sel);
    }
    if (desc->text_font[0]) {
        /* Bitmap fonts need static codegen; runtime uses LVGL default as stub. */
        lv_obj_set_style_text_font(obj, &lv_font_montserrat_14, sel);
    }
    if (desc->style_radius >= 0) {
        lv_obj_set_style_radius(obj, desc->style_radius, sel);
    }
    if (desc->style_border_width >= 0) {
        lv_obj_set_style_border_width(obj, desc->style_border_width, sel);
    }
    if (desc->style_border_color[0]) {
        lv_obj_set_style_border_color(obj, lv_color_hex(color_to_hex(desc->style_border_color)), sel);
    }
    if (desc->style_pad_top >= 0) {
        lv_obj_set_style_pad_top(obj, desc->style_pad_top, sel);
    }
    if (desc->style_pad_right >= 0) {
        lv_obj_set_style_pad_right(obj, desc->style_pad_right, sel);
    }
    if (desc->style_pad_bottom >= 0) {
        lv_obj_set_style_pad_bottom(obj, desc->style_pad_bottom, sel);
    }
    if (desc->style_pad_left >= 0) {
        lv_obj_set_style_pad_left(obj, desc->style_pad_left, sel);
    }
    if (desc->style_shadow_width >= 0) {
        lv_obj_set_style_shadow_width(obj, desc->style_shadow_width, sel);
    }
    if (desc->style_shadow_color[0]) {
        lv_obj_set_style_shadow_color(obj, lv_color_hex(color_to_hex(desc->style_shadow_color)), sel);
    }
    if (desc->style_shadow_ofs_x >= 0) {
        lv_obj_set_style_shadow_ofs_x(obj, desc->style_shadow_ofs_x, sel);
    }
    if (desc->style_shadow_ofs_y >= 0) {
        lv_obj_set_style_shadow_ofs_y(obj, desc->style_shadow_ofs_y, sel);
    }
    if (desc->style_bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)desc->style_bg_opacity, sel);
    }
    if (desc->style_text_opacity >= 0) {
        lv_obj_set_style_text_opa(obj, (lv_opa_t)desc->style_text_opacity, sel);
    }
    if (desc->style_border_opacity >= 0) {
        lv_obj_set_style_border_opa(obj, (lv_opa_t)desc->style_border_opacity, sel);
    }
    if (desc->style_shadow_opacity >= 0) {
        lv_obj_set_style_shadow_opa(obj, (lv_opa_t)desc->style_shadow_opacity, sel);
    }
    if (desc->style_text_letter_space >= 0) {
        lv_obj_set_style_text_letter_space(obj, desc->style_text_letter_space, sel);
    }
    if (desc->style_text_line_space >= 0) {
        lv_obj_set_style_text_line_space(obj, desc->style_text_line_space, sel);
    }
    if (desc->style_clip_corner >= 0) {
        lv_obj_set_style_clip_corner(obj, desc->style_clip_corner ? true : false, sel);
    }
    if (desc->style_line_color[0]) {
        lv_obj_set_style_line_color(obj, lv_color_hex(color_to_hex(desc->style_line_color)), sel);
    }
    if (desc->style_line_width >= 0) {
        lv_obj_set_style_line_width(obj, desc->style_line_width, sel);
    }
    if (desc->style_line_opacity >= 0) {
        lv_obj_set_style_line_opa(obj, (lv_opa_t)desc->style_line_opacity, sel);
    }
    if (desc->style_outline_width >= 0) {
        lv_obj_set_style_outline_width(obj, desc->style_outline_width, sel);
    }
    if (desc->style_outline_color[0]) {
        lv_obj_set_style_outline_color(obj, lv_color_hex(color_to_hex(desc->style_outline_color)), sel);
    }
    if (desc->style_outline_opacity >= 0) {
        lv_obj_set_style_outline_opa(obj, (lv_opa_t)desc->style_outline_opacity, sel);
    }
    if (desc->image_src[0]) {
        lv_obj_set_style_bg_image_src(obj, desc->image_src, sel);
    }
}

static void apply_indicator_styles(lv_obj_t *obj, const forge_json_widget_desc_t *desc)
{
    lv_style_selector_t sel;

    if (!obj) return;

    sel = LV_PART_INDICATOR | LV_STATE_DEFAULT;
    if (desc->indicator_bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(desc->indicator_bg_color)), sel);
    }
    if (desc->indicator_bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)desc->indicator_bg_opacity, sel);
    }
    if (desc->indicator_style_radius >= 0) {
        lv_obj_set_style_radius(obj, desc->indicator_style_radius, sel);
    }

    sel = LV_PART_INDICATOR | LV_STATE_PRESSED;
    if (desc->indicator_pressed_bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(desc->indicator_pressed_bg_color)), sel);
    }
    if (desc->indicator_pressed_bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)desc->indicator_pressed_bg_opacity, sel);
    }
}

static void apply_knob_styles(lv_obj_t *obj, const forge_json_widget_desc_t *desc)
{
    lv_style_selector_t sel;

    if (!obj) return;

    sel = LV_PART_KNOB | LV_STATE_DEFAULT;
    if (desc->knob_bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(desc->knob_bg_color)), sel);
    }
    if (desc->knob_bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)desc->knob_bg_opacity, sel);
    }
    if (desc->knob_style_radius >= 0) {
        lv_obj_set_style_radius(obj, desc->knob_style_radius, sel);
    }

    sel = LV_PART_KNOB | LV_STATE_PRESSED;
    if (desc->knob_pressed_bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(desc->knob_pressed_bg_color)), sel);
    }
    if (desc->knob_pressed_bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)desc->knob_pressed_bg_opacity, sel);
    }
}

static void apply_subpart_style(lv_obj_t *obj, lv_part_t part, const forge_json_subpart_style_t *style,
                                int apply_pressed)
{
    lv_style_selector_t sel;

    if (!obj || !style) return;

    sel = part | LV_STATE_DEFAULT;
    if (style->bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(style->bg_color)), sel);
    }
    if (style->text_color[0]) {
        lv_obj_set_style_text_color(obj, lv_color_hex(color_to_hex(style->text_color)), sel);
    }
    if (style->bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)style->bg_opacity, sel);
    }
    if (style->radius >= 0) {
        lv_obj_set_style_radius(obj, style->radius, sel);
    }

    if (!apply_pressed) return;
    sel = part | LV_STATE_PRESSED;
    if (style->pressed_bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(style->pressed_bg_color)), sel);
    }
    if (style->pressed_bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)style->pressed_bg_opacity, sel);
    }
}

static void apply_items_scrollbar_styles(lv_obj_t *obj, const forge_json_widget_desc_t *desc)
{
    if (!obj) return;
    apply_subpart_style(obj, LV_PART_ITEMS, &desc->items_style, 1);
    apply_subpart_style(obj, LV_PART_SCROLLBAR, &desc->scrollbar_style, 0);
}

static void apply_state_style(lv_obj_t *obj, lv_part_t part, lv_state_t state,
                              const forge_json_state_style_t *style)
{
    lv_style_selector_t sel;

    if (!obj || !style) return;

    sel = part | state;
    if (style->bg_color[0]) {
        lv_obj_set_style_bg_color(obj, lv_color_hex(color_to_hex(style->bg_color)), sel);
    }
    if (style->text_color[0]) {
        lv_obj_set_style_text_color(obj, lv_color_hex(color_to_hex(style->text_color)), sel);
    }
    if (style->bg_opacity >= 0) {
        lv_obj_set_style_bg_opa(obj, (lv_opa_t)style->bg_opacity, sel);
    }
    if (style->radius >= 0) {
        lv_obj_set_style_radius(obj, style->radius, sel);
    }
}

static void apply_selected_checked_styles(lv_obj_t *obj, const forge_json_widget_desc_t *desc)
{
    if (!obj) return;
    apply_subpart_style(obj, LV_PART_SELECTED, &desc->selected_style, 0);
    apply_state_style(obj, LV_PART_MAIN, LV_STATE_CHECKED, &desc->main_checked_style);
    apply_state_style(obj, LV_PART_MAIN, LV_STATE_PRESSED, &desc->main_pressed_style);
    apply_state_style(obj, LV_PART_MAIN, LV_STATE_FOCUSED, &desc->main_focused_style);
    apply_state_style(obj, LV_PART_MAIN, LV_STATE_DISABLED, &desc->main_disabled_style);
    apply_state_style(obj, LV_PART_ITEMS, LV_STATE_CHECKED, &desc->items_checked_style);
    apply_state_style(obj, LV_PART_ITEMS, LV_STATE_PRESSED, &desc->items_pressed_style);
    apply_state_style(obj, LV_PART_ITEMS, LV_STATE_FOCUSED, &desc->items_focused_style);
    apply_state_style(obj, LV_PART_ITEMS, LV_STATE_DISABLED, &desc->items_disabled_style);
}

static void apply_cursor_series_styles(lv_obj_t *obj, const forge_json_widget_desc_t *desc)
{
    if (!obj) return;
    apply_subpart_style(obj, LV_PART_CURSOR, &desc->cursor_style, 1);
    apply_subpart_style(obj, LV_PART_ITEMS, &desc->series_style, 0);
}

static void bind_image_src(lv_obj_t *obj, const char *src)
{
    if (obj && src && src[0]) {
        lv_image_set_src(obj, src);
    }
}

static void bind_imagebutton_src(lv_obj_t *obj, lv_imagebutton_state_t state, const char *src)
{
    if (obj && src && src[0]) {
        lv_imagebutton_set_src(obj, state, NULL, src, NULL);
    }
}

static void apply_chart_series(lv_obj_t *chart, const forge_json_widget_desc_t *desc)
{
    int i;

    for (i = 0; i < desc->series_count; i++) {
        const forge_json_chart_series_t *ser = &desc->series[i];
        lv_chart_series_t *cs = lv_chart_add_series(
            chart,
            lv_color_hex(color_to_hex(ser->color)),
            LV_CHART_AXIS_PRIMARY_Y);
        if (cs && ser->value_count > 0) {
            lv_chart_set_series_values(chart, cs, ser->values, ser->value_count);
        }
    }
}

static lv_obj_t *create_widget_lvgl(lv_obj_t *parent, const forge_json_widget_desc_t *desc)
{
    lv_obj_t *obj = NULL;

    if (strcmp(desc->type, "label") == 0) {
        obj = lv_label_create(parent);
        if (desc->text[0]) {
            lv_label_set_text(obj, desc->text);
        }
    } else if (strcmp(desc->type, "button") == 0) {
        obj = lv_button_create(parent);
        if (desc->text[0]) {
            lv_obj_t *lbl = lv_label_create(obj);
            lv_label_set_text(lbl, desc->text);
            lv_obj_center(lbl);
        }
    } else if (strcmp(desc->type, "container") == 0) {
        obj = lv_obj_create(parent);
    } else if (strcmp(desc->type, "slider") == 0) {
        obj = lv_slider_create(parent);
        lv_slider_set_range(obj, desc->min, desc->max);
        lv_slider_set_value(obj, desc->value, LV_ANIM_OFF);
    } else if (strcmp(desc->type, "switch") == 0) {
        obj = lv_switch_create(parent);
        if (desc->checked) {
            lv_obj_add_state(obj, LV_STATE_CHECKED);
        }
    } else if (strcmp(desc->type, "image") == 0) {
        obj = lv_image_create(parent);
        bind_image_src(obj, desc->image_src);
    } else if (strcmp(desc->type, "imagebutton") == 0) {
        obj = lv_imagebutton_create(parent);
        bind_imagebutton_src(obj, LV_IMAGEBUTTON_STATE_RELEASED, desc->image_src_released);
        bind_imagebutton_src(obj, LV_IMAGEBUTTON_STATE_PRESSED, desc->image_src_pressed);
    } else if (strcmp(desc->type, "animimg") == 0) {
        obj = lv_animimg_create(parent);
        lv_animimg_set_duration(obj, desc->anim_time > 0 ? desc->anim_time : 200);
        if (desc->frame_count > 0) {
            const void *srcs[FORGE_JSON_MAX_FRAMES];
            int i;
            for (i = 0; i < desc->frame_count; i++) {
                srcs[i] = desc->frames[i];
            }
            lv_animimg_set_src(obj, srcs, desc->frame_count);
            lv_animimg_set_repeat_count(obj, desc->anim_repeat ? LV_ANIM_REPEAT_INFINITE : 1);
            lv_animimg_start(obj);
        }
    } else if (strcmp(desc->type, "tabview") == 0) {
        lv_dir_t dir = LV_DIR_TOP;
        int i;
        if (strcmp(desc->tab_bar_position, "BOTTOM") == 0) {
            dir = LV_DIR_BOTTOM;
        } else if (strcmp(desc->tab_bar_position, "LEFT") == 0) {
            dir = LV_DIR_LEFT;
        } else if (strcmp(desc->tab_bar_position, "RIGHT") == 0) {
            dir = LV_DIR_RIGHT;
        }
        obj = lv_tabview_create(parent);
        lv_tabview_set_tab_bar_size(obj, desc->tab_bar_size > 0 ? desc->tab_bar_size : 40);
        lv_tabview_set_tab_bar_position(obj, dir);
        for (i = 0; i < desc->item_count; i++) {
            lv_tabview_add_tab(obj, desc->items[i]);
        }
        if (desc->selected_tab_index > 0) {
            lv_tabview_set_active(obj, desc->selected_tab_index, LV_ANIM_OFF);
        }
    } else if (strcmp(desc->type, "buttonmatrix") == 0) {
        const char *map[FORGE_JSON_MAX_ITEMS + 4];
        int map_len = 0;
        int col_cnt;
        int i;
        obj = lv_buttonmatrix_create(parent);
        col_cnt = desc->col_cnt > 0 ? desc->col_cnt : 3;
        for (i = 0; i < desc->item_count; i++) {
            if (i > 0 && i % col_cnt == 0) {
                map[map_len++] = "\n";
            }
            map[map_len++] = desc->items[i];
        }
        map[map_len++] = "";
        lv_buttonmatrix_set_map(obj, map);
    } else if (strcmp(desc->type, "keyboard") == 0) {
        obj = lv_keyboard_create(parent);
        lv_keyboard_set_mode(obj, keyboard_mode_from_string(desc->keyboard_mode));
        apply_keyboard_keymap(obj, desc);
    } else if (strcmp(desc->type, "msgbox") == 0) {
        int i;
        obj = lv_msgbox_create(parent);
        if (desc->title[0]) {
            lv_msgbox_add_title(obj, desc->title);
        }
        if (desc->text[0]) {
            lv_msgbox_add_text(obj, desc->text);
        }
        for (i = 0; i < desc->item_count; i++) {
            lv_msgbox_add_footer_button(obj, desc->items[i]);
        }
    } else if (strcmp(desc->type, "table") == 0) {
        int i;
        obj = lv_table_create(parent);
        lv_table_set_row_count(obj, desc->row_cnt > 0 ? desc->row_cnt : 3);
        lv_table_set_column_count(obj, desc->col_cnt > 0 ? desc->col_cnt : 2);
        for (i = 0; i < desc->cell_count; i++) {
            lv_table_set_cell_value(obj, desc->cell_row[i], desc->cell_col[i], desc->cells[i]);
        }
    } else if (strcmp(desc->type, "chart") == 0 || strcmp(desc->type, "linechart") == 0 ||
               strcmp(desc->type, "barchart") == 0 || strcmp(desc->type, "scatterchart") == 0) {
        obj = lv_chart_create(parent);
        lv_chart_set_point_count(obj, desc->point_count > 0 ? desc->point_count : 10);
        if (strcmp(desc->type, "barchart") == 0) {
            lv_chart_set_type(obj, LV_CHART_TYPE_BAR);
        } else if (strcmp(desc->type, "scatterchart") == 0) {
            lv_chart_set_type(obj, LV_CHART_TYPE_SCATTER);
        } else {
            lv_chart_set_type(obj, LV_CHART_TYPE_LINE);
        }
        apply_chart_series(obj, desc);
    } else if (strcmp(desc->type, "spinbox") == 0) {
        obj = lv_spinbox_create(parent);
        lv_spinbox_set_range(obj, desc->min, desc->max);
        lv_spinbox_set_value(obj, desc->value);
    } else if (strcmp(desc->type, "canvas") == 0) {
        obj = lv_canvas_create(parent);
    } else if (strcmp(desc->type, "qrcode") == 0) {
        obj = lv_qrcode_create(parent);
        lv_qrcode_set_size(obj, desc->qr_size > 0 ? desc->qr_size : 80);
        if (desc->text[0]) {
            lv_qrcode_update(obj, desc->text, (uint32_t)strlen(desc->text));
        }
    } else if (strcmp(desc->type, "barcode") == 0) {
        obj = lv_barcode_create(parent);
        if (desc->text[0]) {
            lv_barcode_update(obj, desc->text);
        }
    } else if (strcmp(desc->type, "digitalclock") == 0) {
        obj = lv_label_create(parent);
        lv_label_set_text(obj, desc->text[0] ? desc->text : "12:00:00");
    } else if (strcmp(desc->type, "tileview") == 0) {
        obj = lv_tileview_create(parent);
    } else if (strcmp(desc->type, "win") == 0) {
        obj = lv_win_create(parent);
        if (desc->title[0]) {
            lv_win_add_title(obj, desc->title);
        }
    } else if (strcmp(desc->type, "menu") == 0) {
        obj = lv_menu_create(parent);
    } else if (strcmp(desc->type, "spangroup") == 0) {
        int i;
        obj = lv_spangroup_create(parent);
        for (i = 0; i < desc->item_count; i++) {
            lv_span_t *span = lv_spangroup_add_span(obj);
            lv_span_set_text(span, desc->items[i]);
        }
    } else if (strcmp(desc->type, "scale") == 0) {
        obj = lv_scale_create(parent);
    } else if (strcmp(desc->type, "calendar") == 0) {
        obj = lv_calendar_create(parent);
        if (desc->today_year > 0) {
            lv_calendar_set_today_date(obj, desc->today_year, desc->today_month, desc->today_day);
        }
    } else if (strcmp(desc->type, "checkbox") == 0) {
        obj = lv_checkbox_create(parent);
        if (desc->text[0]) {
            lv_checkbox_set_text(obj, desc->text);
        }
        if (desc->checked) {
            lv_obj_add_state(obj, LV_STATE_CHECKED);
        }
    } else if (strcmp(desc->type, "bar") == 0) {
        obj = lv_bar_create(parent);
        lv_bar_set_range(obj, desc->min, desc->max);
        lv_bar_set_value(obj, desc->value, LV_ANIM_OFF);
    } else if (strcmp(desc->type, "dropdown") == 0) {
        char opts[512];
        int i;
        size_t pos = 0;
        obj = lv_dropdown_create(parent);
        for (i = 0; i < desc->item_count; i++) {
            if (i > 0 && pos + 1 < sizeof(opts)) {
                opts[pos++] = '\n';
            }
            pos += (size_t)snprintf(opts + pos, sizeof(opts) - pos, "%s", desc->items[i]);
        }
        opts[sizeof(opts) - 1] = '\0';
        if (desc->item_count > 0) {
            lv_dropdown_set_options(obj, opts);
        } else if (desc->text[0]) {
            lv_dropdown_set_options(obj, desc->text);
        }
    } else if (strcmp(desc->type, "list") == 0) {
        int i;
        obj = lv_list_create(parent);
        for (i = 0; i < desc->item_count; i++) {
            lv_list_add_text(obj, desc->items[i]);
        }
    } else if (strcmp(desc->type, "led") == 0) {
        obj = lv_led_create(parent);
        lv_led_set_brightness(obj, desc->bright);
        lv_led_set_color(obj, lv_color_hex(color_to_hex(desc->color)));
    } else if (strcmp(desc->type, "spinner") == 0) {
        obj = lv_spinner_create(parent);
        lv_spinner_set_anim_params(obj,
                                   desc->anim_time > 0 ? (uint32_t)desc->anim_time : 1000U,
                                   desc->arc_length > 0 ? (uint32_t)desc->arc_length : 60U);
    } else if (strcmp(desc->type, "arc") == 0) {
        obj = lv_arc_create(parent);
        lv_arc_set_range(obj, desc->min, desc->max);
        lv_arc_set_value(obj, desc->value);
    } else if (strcmp(desc->type, "roller") == 0) {
        char opts[512];
        int i;
        size_t pos = 0;
        obj = lv_roller_create(parent);
        lv_roller_set_visible_row_count(obj, desc->visible_row_count);
        for (i = 0; i < desc->item_count; i++) {
            if (i > 0 && pos + 1 < sizeof(opts)) {
                opts[pos++] = '\n';
            }
            pos += (size_t)snprintf(opts + pos, sizeof(opts) - pos, "%s", desc->items[i]);
        }
        opts[sizeof(opts) - 1] = '\0';
        if (desc->item_count > 0) {
            lv_roller_set_options(obj, opts, LV_ROLLER_MODE_NORMAL);
        }
    } else if (strcmp(desc->type, "textarea") == 0) {
        obj = lv_textarea_create(parent);
        if (desc->text[0]) {
            lv_textarea_set_text(obj, desc->text);
        }
    } else if (strcmp(desc->type, "line") == 0) {
        lv_point_precise_t pts[2];
        obj = lv_line_create(parent);
        pts[0].x = 0;
        pts[0].y = 0;
        pts[1].x = desc->w > 0 ? desc->w : 100;
        pts[1].y = 0;
        lv_line_set_points(obj, pts, 2);
    }

    if (!obj) return NULL;

    lv_obj_set_pos(obj, desc->x, desc->y);
    if (desc->w > 0 && desc->h > 0) {
        lv_obj_set_size(obj, desc->w, desc->h);
    }
    apply_main_default_style(obj, desc);
    apply_indicator_styles(obj, desc);
    apply_knob_styles(obj, desc);
    apply_items_scrollbar_styles(obj, desc);
    apply_selected_checked_styles(obj, desc);
    apply_cursor_series_styles(obj, desc);
    apply_frame_rotation(obj, desc->frame_rotation);
    if (strcmp(desc->type, "container") == 0) {
        apply_container_layout(obj, desc->layout_type);
    }
    return obj;
}

static int build_lvgl_from_object(const char *obj, lv_obj_t *parent)
{
    forge_json_widget_desc_t desc;
    lv_obj_t *created = NULL;
    lv_obj_t *child_parent;
    const char *child_arr;
    const char *p;
    int depth;

    if (parse_widget_object(obj, &desc) != 0) return E_LOADER_FMT;

    if (is_supported_widget(desc.type)) {
        created = create_widget_lvgl(parent, &desc);
        if (!created) return E_LOADER_FMT;
    }

    child_parent = (created && is_json_container(desc.type)) ? created : parent;
    child_arr = find_children_array(obj);
    if (!child_arr) return E_LOADER_OK;

    p = child_arr + 1;
    while (*p) {
        char chunk[WIDGET_OBJ_MAX];
        const char *start;
        size_t len;

        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
        if (*p == ']') break;
        if (*p != '{') return E_LOADER_FMT;

        start = p;
        depth = 0;
        do {
            if (*p == '{') depth++;
            else if (*p == '}') depth--;
            p++;
        } while (*p && depth > 0);
        if (depth != 0) return E_LOADER_FMT;

        len = (size_t)(p - start);
        if (len >= sizeof(chunk)) len = sizeof(chunk) - 1;
        memcpy(chunk, start, len);
        chunk[len] = '\0';

        if (build_lvgl_from_object(chunk, child_parent) != E_LOADER_OK) {
            return E_LOADER_FMT;
        }
    }

    return E_LOADER_OK;
}

static int build_lvgl_from_screen_json(const char *json, lv_obj_t *screen)
{
    const char *arr = find_children_array(json);
    const char *p;
    int depth;

    if (!arr) return E_LOADER_OK;
    p = arr + 1;
    while (*p) {
        char chunk[WIDGET_OBJ_MAX];
        const char *start;
        size_t len;

        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
        if (*p == ']') break;
        if (*p != '{') return E_LOADER_FMT;

        start = p;
        depth = 0;
        do {
            if (*p == '{') depth++;
            else if (*p == '}') depth--;
            p++;
        } while (*p && depth > 0);
        if (depth != 0) return E_LOADER_FMT;

        len = (size_t)(p - start);
        if (len >= sizeof(chunk)) len = sizeof(chunk) - 1;
        memcpy(chunk, start, len);
        chunk[len] = '\0';

        if (build_lvgl_from_object(chunk, screen) != E_LOADER_OK) {
            return E_LOADER_FMT;
        }
    }
    return E_LOADER_OK;
}

int forge_json_runtime_load_screen(const char *package_root, const char *screen_id, lv_obj_t **out_screen)
{
    char *json;
    int16_t sw = 480;
    int16_t sh = 320;
    lv_obj_t *screen;
    const char *frame;

    if (!package_root || !screen_id || !out_screen) return E_LOADER_FMT;
    *out_screen = NULL;

    json = (char *)malloc(SCREEN_JSON_MAX);
    if (!json) return E_LOADER_FMT;
    if (load_screen_json(package_root, screen_id, json, SCREEN_JSON_MAX) != E_LOADER_OK) {
        free(json);
        return E_LOADER_FMT;
    }

    frame = strstr(json, "\"frame\"");
    if (frame) {
        read_s16_json_field(frame, "w", &sw);
        read_s16_json_field(frame, "h", &sh);
    }

    screen = lv_obj_create(NULL);
    if (!screen) {
        free(json);
        return E_LOADER_FMT;
    }
    lv_obj_set_size(screen, sw > 0 ? sw : 480, sh > 0 ? sh : 320);

    if (build_lvgl_from_screen_json(json, screen) != E_LOADER_OK) {
        lv_obj_delete(screen);
        free(json);
        return E_LOADER_FMT;
    }
    free(json);

    *out_screen = screen;
    return E_LOADER_OK;
}

#endif
