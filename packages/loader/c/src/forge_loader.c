#include "forge_loader.h"
#include "forge_json_runtime.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>



#define MANIFEST_MAX 8192

#define PATH_MAX_LOCAL 512



#if defined(__GNUC__) || defined(__clang__)

#define FORGE_WEAK __attribute__((weak))

#else

#define FORGE_WEAK

#endif



/** Provided by forgeui_generated when A1 static UI is linked; weak no-op otherwise. */

FORGE_WEAK void ui_init(void)

{

}



FORGE_WEAK void ui_nav_load_screen(const char *screen_id)

{

    (void)screen_id;

}



struct forge_ui_package {

    char *root_path;

    char entry_screen[64];

    int applied;

};



static int join_path(char *out, size_t out_len, const char *base, const char *rel)

{

    size_t bl = strlen(base);

    int need_sep = bl > 0 && base[bl - 1] != '/' && base[bl - 1] != '\\';

    int n = snprintf(out, out_len, need_sep ? "%s/%s" : "%s%s", base, rel);

    return n > 0 && (size_t)n < out_len ? 0 : -1;

}



static int file_exists(const char *path)

{

    FILE *f = fopen(path, "rb");

    if (!f) return 0;

    fclose(f);

    return 1;

}



static long file_size_bytes(const char *path)

{

    FILE *f = fopen(path, "rb");

    long sz;

    if (!f) return -1;

    if (fseek(f, 0, SEEK_END) != 0) {

        fclose(f);

        return -1;

    }

    sz = ftell(f);

    fclose(f);

    return sz;

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



static int read_u16_json_field(const char *json, const char *key, uint16_t *out)

{

    char pattern[48];

    snprintf(pattern, sizeof(pattern), "\"%s\":", key);

    const char *p = strstr(json, pattern);

    if (!p) return -1;

    p += strlen(pattern);

    while (*p == ' ' || *p == '\t') p++;

    unsigned v = 0;

    if (sscanf(p, "%u", &v) != 1) return -1;

    *out = (uint16_t)v;

    return 0;

}



static int read_u32_json_field(const char *json, const char *key, uint32_t *out)

{

    char pattern[48];

    snprintf(pattern, sizeof(pattern), "\"%s\":", key);

    const char *p = strstr(json, pattern);

    if (!p) return -1;

    p += strlen(pattern);

    while (*p == ' ' || *p == '\t') p++;

    unsigned v = 0;

    if (sscanf(p, "%u", &v) != 1) return -1;

    *out = (uint32_t)v;

    return 0;

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



static int validate_screen_json(const char *root, const char *screen_id)

{

    char rel[96];

    char path[PATH_MAX_LOCAL];



    if (!screen_id || screen_id[0] == '\0') return E_LOADER_FMT;

    snprintf(rel, sizeof(rel), "ui/screens/%s.json", screen_id);

    if (join_path(path, sizeof(path), root, rel) != 0) return E_LOADER_FMT;

    return file_exists(path) ? E_LOADER_OK : E_LOADER_FMT;

}



static int validate_manifest_screens(const char *root, const char *manifest)

{

    const char *screens = strstr(manifest, "\"screens\"");

    if (!screens) return E_LOADER_OK;



    const char *p = strchr(screens, '[');

    if (!p) return E_LOADER_FMT;

    p++;



    int found = 0;

    while (*p && *p != ']') {

        while (*p == ' ' || *p == '\t' || *p == ',') p++;

        if (*p == ']') break;

        if (*p != '"') return E_LOADER_FMT;

        p++;

        char id[64];

        size_t i = 0;

        while (*p && *p != '"' && i + 1 < sizeof(id)) id[i++] = *p++;

        id[i] = '\0';

        if (*p != '"') return E_LOADER_FMT;

        p++;

        if (validate_screen_json(root, id) != E_LOADER_OK) return E_LOADER_FMT;

        found = 1;

    }

    return found ? E_LOADER_OK : E_LOADER_FMT;

}



static int validate_assets_manifest(const char *root)

{

    char path[PATH_MAX_LOCAL];

    char buf[MANIFEST_MAX];

    const char *p;



    if (join_path(path, sizeof(path), root, "assets/manifest.json") != 0) return E_LOADER_FMT;

    if (read_text_file(path, buf, sizeof(buf)) < 0) return E_LOADER_FMT;



    p = buf;

    while ((p = strstr(p, "\"path\"")) != NULL) {

        char rel[128];

        uint32_t expected = 0;

        long actual;



        p = strchr(p, ':');

        if (!p) return E_LOADER_FMT;

        p++;

        while (*p == ' ' || *p == '\t') p++;

        if (*p != '"') return E_LOADER_FMT;

        p++;

        {

            size_t i = 0;

            while (*p && *p != '"' && i + 1 < sizeof(rel)) rel[i++] = *p++;

            rel[i] = '\0';

        }

        if (*p != '"') return E_LOADER_FMT;



        if (read_u32_json_field(p, "size", &expected) != 0) return E_LOADER_FMT;

        if (join_path(path, sizeof(path), root, "assets") != 0) return E_LOADER_FMT;

        {

            char asset_path[PATH_MAX_LOCAL];

            if (join_path(asset_path, sizeof(asset_path), path, rel) != 0) return E_LOADER_FMT;

            if (!file_exists(asset_path)) return E_LOADER_FMT;

            actual = file_size_bytes(asset_path);

            if (actual < 0 || (uint32_t)actual != expected) return E_LOADER_FMT;

        }

        p++;

    }

    return E_LOADER_OK;

}



static int validate_package_layout(const char *root, char *manifest_buf, size_t manifest_len)

{

    char path[PATH_MAX_LOCAL];



    if (join_path(path, sizeof(path), root, "manifest.json") != 0) return E_LOADER_FMT;

    if (!file_exists(path)) return E_LOADER_FMT;

    if (read_text_file(path, manifest_buf, manifest_len) < 0) return E_LOADER_FMT;



    if (join_path(path, sizeof(path), root, "ui/project.meta.json") != 0) return E_LOADER_FMT;

    if (!file_exists(path)) return E_LOADER_FMT;



    if (join_path(path, sizeof(path), root, "assets/manifest.json") != 0) return E_LOADER_FMT;

    if (!file_exists(path)) return E_LOADER_FMT;



    if (validate_manifest_screens(root, manifest_buf) != E_LOADER_OK) return E_LOADER_FMT;

    if (validate_assets_manifest(root) != E_LOADER_OK) return E_LOADER_FMT;



    {

        char entry[64];

        if (read_string_json_field(manifest_buf, "entryScreen", entry, sizeof(entry)) == 0) {

            if (validate_screen_json(root, entry) != E_LOADER_OK) return E_LOADER_FMT;

        }

    }



    return E_LOADER_OK;

}



static void parse_entry_screen(const char *manifest, char *entry, size_t entry_len)

{

    if (read_string_json_field(manifest, "entryScreen", entry, entry_len) != 0) {

        strncpy(entry, "home", entry_len);

        entry[entry_len - 1] = '\0';

    }

}



int forge_loader_open_file(const char *path, forge_ui_package_t **out)

{

    char manifest[MANIFEST_MAX];



    if (!path || !out) return E_LOADER_FMT;

    *out = NULL;



    if (validate_package_layout(path, manifest, sizeof(manifest)) != E_LOADER_OK) {

        return E_LOADER_FMT;

    }



    forge_ui_package_t *pkg = (forge_ui_package_t *)calloc(1, sizeof(*pkg));

    if (!pkg) return E_LOADER_FMT;

    size_t n = strlen(path) + 1;

    pkg->root_path = (char *)malloc(n);

    if (!pkg->root_path) {

        free(pkg);

        return E_LOADER_FMT;

    }

    memcpy(pkg->root_path, path, n);

    parse_entry_screen(manifest, pkg->entry_screen, sizeof(pkg->entry_screen));

    *out = pkg;

    return E_LOADER_OK;

}



static int parse_mem_descriptor(const void *buf, size_t len, char *root_out, size_t root_len)

{

    char json[512];

    char format[32];

    size_t copy_len;



    if (!buf || len == 0 || !root_out || root_len == 0) return -1;



    copy_len = len;

    if (copy_len >= sizeof(json)) copy_len = sizeof(json) - 1;

    memcpy(json, buf, copy_len);

    json[copy_len] = '\0';



    if (read_string_json_field(json, "format", format, sizeof(format)) == 0) {

        if (strcmp(format, "forgeui-mem-ref") != 0) return -1;

    }



    if (read_string_json_field(json, "root", root_out, root_len) != 0) return -1;

    if (root_out[0] == '\0') return -1;

    return 0;

}



int forge_loader_open_mem(const void *buf, size_t len, forge_ui_package_t **out)

{

    char manifest[MANIFEST_MAX];

    char root[PATH_MAX_LOCAL];



    if (!buf || !out) return E_LOADER_FMT;

    *out = NULL;



    if (parse_mem_descriptor(buf, len, root, sizeof(root)) != 0) return E_LOADER_FMT;



    if (validate_package_layout(root, manifest, sizeof(manifest)) != E_LOADER_OK) {

        return E_LOADER_FMT;

    }



    {

        forge_ui_package_t *pkg = (forge_ui_package_t *)calloc(1, sizeof(*pkg));

        size_t n;



        if (!pkg) return E_LOADER_FMT;

        n = strlen(root) + 1;

        pkg->root_path = (char *)malloc(n);

        if (!pkg->root_path) {

            free(pkg);

            return E_LOADER_FMT;

        }

        memcpy(pkg->root_path, root, n);

        parse_entry_screen(manifest, pkg->entry_screen, sizeof(pkg->entry_screen));

        *out = pkg;

        return E_LOADER_OK;

    }

}



int forge_loader_check_compat(const forge_ui_package_t *pkg, const forge_loader_caps_t *caps)

{

    char path[PATH_MAX_LOCAL];

    char manifest[MANIFEST_MAX];

    uint16_t w = 0, h = 0, depth = 0, major = 0;



    if (!pkg || !caps || !pkg->root_path) return E_LOADER_FMT;



    if (join_path(path, sizeof(path), pkg->root_path, "manifest.json") != 0) return E_LOADER_FMT;

    if (read_text_file(path, manifest, sizeof(manifest)) < 0) return E_LOADER_FMT;



    if (read_u16_json_field(manifest, "width", &w) == 0 && w != 0 && w != caps->width) {

        return E_LOADER_RES;

    }

    if (read_u16_json_field(manifest, "height", &h) == 0 && h != 0 && h != caps->height) {

        return E_LOADER_RES;

    }

    const char *disp = strstr(manifest, "\"display\"");

    if (disp) {

        if (read_u16_json_field(disp, "width", &w) == 0 && w != 0 && w != caps->width) {

            return E_LOADER_RES;

        }

        if (read_u16_json_field(disp, "height", &h) == 0 && h != 0 && h != caps->height) {

            return E_LOADER_RES;

        }

        if (read_u16_json_field(disp, "colorDepth", &depth) == 0 && depth != 0 && depth != caps->color_depth) {

            return E_LOADER_RES;

        }

    }



    if (read_u16_json_field(manifest, "lvglMajor", &major) == 0 && major != 0 && major != caps->lvgl_major) {

        return E_LOADER_VER;

    }



    return E_LOADER_OK;

}



int forge_loader_apply(forge_ui_package_t *pkg)

{

    char manifest[MANIFEST_MAX];



    if (!pkg || !pkg->root_path) return E_LOADER_FMT;

    if (pkg->applied) return E_LOADER_OK;



    if (validate_package_layout(pkg->root_path, manifest, sizeof(manifest)) != E_LOADER_OK) {

        return E_LOADER_FMT;

    }

    parse_entry_screen(manifest, pkg->entry_screen, sizeof(pkg->entry_screen));



    ui_init();

    ui_nav_load_screen(pkg->entry_screen);

    pkg->applied = 1;

    return E_LOADER_OK;

}



int forge_loader_apply_json(forge_ui_package_t *pkg)

{

    char manifest[MANIFEST_MAX];

    forge_json_widget_desc_t widgets[64];

    int widget_count = 0;



    if (!pkg || !pkg->root_path) return E_LOADER_FMT;

    if (pkg->applied) return E_LOADER_OK;



    if (validate_package_layout(pkg->root_path, manifest, sizeof(manifest)) != E_LOADER_OK) {

        return E_LOADER_FMT;

    }

    parse_entry_screen(manifest, pkg->entry_screen, sizeof(pkg->entry_screen));



    if (forge_json_runtime_parse_screen(

            pkg->root_path, pkg->entry_screen, widgets, 64, &widget_count) != E_LOADER_OK) {

        return E_LOADER_FMT;

    }



#if defined(FORGE_LOADER_WITH_LVGL) && FORGE_LOADER_WITH_LVGL

    {

        lv_obj_t *screen = NULL;

        if (forge_json_runtime_load_screen(pkg->root_path, pkg->entry_screen, &screen) != E_LOADER_OK) {

            return E_LOADER_FMT;

        }

        lv_screen_load(screen);

    }

#else

    if (widget_count <= 0) return E_LOADER_FMT;

#endif



    pkg->applied = 1;

    return E_LOADER_OK;

}



void forge_loader_close(forge_ui_package_t *pkg)

{

    if (!pkg) return;

    free(pkg->root_path);

    free(pkg);

}

