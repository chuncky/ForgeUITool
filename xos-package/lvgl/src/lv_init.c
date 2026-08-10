/**
 * @file lv_init.c
 *
 */

/*********************
 *      INCLUDES
 *********************/
#include "core/lv_global.h"
#include "core/lv_obj.h"
#include "display/lv_display_private.h"
#include "indev/lv_indev_private.h"
#include "layouts/lv_layout.h"
#include "libs/bin_decoder/lv_bin_decoder.h"
#include "libs/bmp/lv_bmp.h"
#include "libs/ffmpeg/lv_ffmpeg.h"
#include "libs/freetype/lv_freetype.h"
#include "libs/fsdrv/lv_fsdrv.h"
#include "libs/gif/lv_gif.h"
#include "libs/tjpgd/lv_tjpgd.h"
#include "libs/libjpeg_turbo/lv_libjpeg_turbo.h"
#include "libs/lodepng/lv_lodepng.h"
#include "libs/libpng/lv_libpng.h"
#include "libs/quajpeg/lv_quajpeg.h"
#include "libs/quapng/lv_quapng.h"
#include "draw/lv_draw.h"
#include "misc/lv_async.h"
#include "misc/lv_fs.h"
#if LV_USE_DRAW_VGLITE
    #include "draw/nxp/vglite/lv_draw_vglite.h"
#endif
#if LV_USE_DRAW_PXP
    #include "draw/nxp/pxp/lv_draw_pxp.h"
#endif
#if LV_USE_DRAW_DAVE2D
    #include "draw/renesas/dave2d/lv_draw_dave2d.h"
#endif
#if LV_USE_DRAW_SDL
    #include "draw/sdl/lv_draw_sdl.h"
#endif
#if LV_USE_DRAW_VG_LITE
    #include "draw/vg_lite/lv_draw_vg_lite.h"
#endif
#if LV_USE_WINDOWS
    #include "drivers/windows/lv_windows_context.h"
#endif
#include "osal/lv_os_private.h"

#if !defined(BUILD_SIMULATOR) || BUILD_SIMULATOR == 0
#include "system/qua_mm_system.h"
/* Non-static: referenced from lv_obj.c and lv_refr.c (device build only) */
qua_mm_system_t *g_lvgl_mm_system = NULL;
#endif

/*********************
 *      DEFINES
 *********************/
#define lv_initialized  LV_GLOBAL_DEFAULT()->inited
#define lv_deinit_in_progress  LV_GLOBAL_DEFAULT()->deinit_in_progress

/**********************
 *      TYPEDEFS
 **********************/

/**********************
 *  STATIC PROTOTYPES
 **********************/

/**********************
 *  STATIC VARIABLES
 **********************/
#if LV_ENABLE_GLOBAL_CUSTOM == 0
    lv_global_t lv_global;
#endif

/**********************
 *      MACROS
 **********************/

#ifndef LV_GLOBAL_INIT
    #define LV_GLOBAL_INIT(__GLOBAL_PTR)    lv_global_init((lv_global_t *)(__GLOBAL_PTR))
#endif

#if LV_USE_PROFILER
#include <stdio.h>
#include <errno.h>
#include <sys/types.h>
#if !defined(_WIN32) && !defined(BUILD_SIMULATOR)
#include <sys/syscall.h>
#endif

extern int g_trace_file;

static void my_flush_cb(const char * buf)
{
    if (g_trace_file < 0)
        return;
    
    int len = strlen(buf);
    int ret = write(g_trace_file, buf, len);
    if (ret != len)
        LV_LOG_ERROR("cannot write file ret=%d len=%d strerror=%s", ret, len, strerror(errno));
    else
        LV_LOG_INFO("write file successfully len=%d", len);
}

static int my_get_tid_cb(void)
{
#ifdef CONFIG_OS_RTT
    return (int)rt_thread_self();
#elif defined(_WIN32) || defined(BUILD_SIMULATOR)
    return 0;
#else
    return (pid_t)syscall(SYS_gettid);
#endif
}

static int my_get_cpu_cb(void)
{
    int cpu_id = 0;
#if defined(_WIN32) || defined(BUILD_SIMULATOR)
    (void)cpu_id;
#else
    syscall(SYS_getcpu, &cpu_id, NULL);
#endif
    return cpu_id;
}
#endif

/**********************
 *   GLOBAL FUNCTIONS
 **********************/
static inline void lv_global_init(lv_global_t * global)
{
    LV_ASSERT_NULL(global);

    if(global == NULL) {
        LV_LOG_ERROR("lv_global cannot be null");
        return;
    }

    lv_memzero(global, sizeof(lv_global_t));

    _lv_ll_init(&(global->disp_ll), sizeof(lv_display_t));
    _lv_ll_init(&(global->indev_ll), sizeof(lv_indev_t));

    global->memory_zero = ZERO_MEM_SENTINEL;
    global->style_refresh = true;
    global->layout_count = _LV_LAYOUT_LAST;
    global->style_last_custom_prop_id = (uint32_t)_LV_STYLE_LAST_BUILT_IN_PROP;
    global->event_last_register_id = _LV_EVENT_LAST;
    lv_rand_set_seed(0x1234ABCD);

#if defined(LV_DRAW_SW_SHADOW_CACHE_SIZE) && LV_DRAW_SW_SHADOW_CACHE_SIZE > 0
    global->sw_shadow_cache.cache_size = -1;
    global->sw_shadow_cache.cache_r = -1;
#endif
}

static inline void _lv_cleanup_devices(lv_global_t * global)
{
    LV_ASSERT_NULL(global);

    if(global) {
        /* cleanup indev and display */
        _lv_ll_clear_custom(&(global->indev_ll), (void (*)(void *)) lv_indev_delete);
        _lv_ll_clear_custom(&(global->disp_ll), (void (*)(void *)) lv_display_delete);
    }
}

bool lv_is_initialized(void)
{
#if LV_ENABLE_GLOBAL_CUSTOM
    if(LV_GLOBAL_DEFAULT()) return lv_initialized;
    else return false;
#else
    return lv_initialized;
#endif
}

void lv_init(void)
{
    /*First initialize Garbage Collection if needed*/
#ifdef LV_GC_INIT
    LV_GC_INIT();
#endif

    /*Do nothing if already initialized*/
    if(lv_initialized) {
        LV_LOG_WARN("lv_init: already initialized");
        return;
    }

    LV_LOG_INFO("begin");

    /*Initialize members of static variable lv_global */
    LV_GLOBAL_INIT(LV_GLOBAL_DEFAULT());

    lv_mem_init();

    _lv_draw_buf_init_handlers();

#if LV_USE_SPAN != 0
    lv_span_stack_init();
#endif

#if LV_USE_PROFILER && LV_USE_PROFILER_BUILTIN
    lv_profiler_builtin_config_t profiler_config;
    lv_profiler_builtin_config_init(&profiler_config);
    profiler_config.flush_cb = my_flush_cb;
    profiler_config.tid_get_cb = my_get_tid_cb;
    profiler_config.cpu_get_cb = my_get_cpu_cb;
    lv_profiler_builtin_init(&profiler_config);
#endif

    lv_os_init();

    _lv_timer_core_init();

    _lv_fs_init();

    _lv_layout_init();

    _lv_anim_core_init();

    _lv_group_init();

    lv_draw_init();

#if LV_USE_DRAW_SW
    lv_draw_sw_init();
#endif

#if LV_USE_DRAW_VGLITE
    lv_draw_vglite_init();
#endif

#if LV_USE_DRAW_PXP
    lv_draw_pxp_init();
#endif

#if LV_USE_DRAW_DAVE2D
    lv_draw_dave2d_init();
#endif

#if LV_USE_DRAW_SDL
    lv_draw_sdl_init();
#endif

#if LV_USE_WINDOWS
    lv_windows_platform_init();
#endif

    _lv_obj_style_init();

    /*Initialize the screen refresh system*/
    _lv_refr_init();

#if LV_USE_SYSMON
    _lv_sysmon_builtin_init();
#endif

    _lv_image_decoder_init();
    lv_bin_decoder_init();  /*LVGL built-in binary image decoder*/

#if LV_USE_DRAW_VG_LITE
    lv_draw_vg_lite_init();
#endif

    /*Test if the IDE has UTF-8 encoding*/
    const char * txt = "Á";

    uint8_t * txt_u8 = (uint8_t *)txt;
    if(txt_u8[0] != 0xc3 || txt_u8[1] != 0x81 || txt_u8[2] != 0x00) {
        LV_LOG_WARN("The strings have no UTF-8 encoding. Non-ASCII characters won't be displayed.");
    }

    uint32_t endianness_test = 0x11223344;
    uint8_t * endianness_test_p = (uint8_t *) &endianness_test;
    bool big_endian = endianness_test_p[0] == 0x11;

    if(big_endian) {
        LV_ASSERT_MSG(LV_BIG_ENDIAN_SYSTEM == 1,
                      "It's a big endian system but LV_BIG_ENDIAN_SYSTEM is not enabled in lv_conf.h");
    }
    else {
        LV_ASSERT_MSG(LV_BIG_ENDIAN_SYSTEM == 0,
                      "It's a little endian system but LV_BIG_ENDIAN_SYSTEM is enabled in lv_conf.h");
    }

#if LV_USE_ASSERT_MEM_INTEGRITY
    LV_LOG_WARN("Memory integrity checks are enabled via LV_USE_ASSERT_MEM_INTEGRITY which makes LVGL much slower");
#endif

#if LV_USE_ASSERT_OBJ
    LV_LOG_WARN("Object sanity checks are enabled via LV_USE_ASSERT_OBJ which makes LVGL much slower");
#endif

#if LV_USE_ASSERT_STYLE
    LV_LOG_WARN("Style sanity checks are enabled that uses more RAM");
#endif

#if LV_LOG_LEVEL == LV_LOG_LEVEL_TRACE
    LV_LOG_WARN("Log level is set to 'Trace' which makes LVGL much slower");
#endif

#if LV_USE_FS_FATFS != '\0'
    lv_fs_fatfs_init();
#endif

#if LV_USE_FS_STDIO != '\0'
    lv_fs_stdio_init();
#endif

#if LV_USE_FS_POSIX != '\0'
    lv_fs_posix_init();
#endif

#if LV_USE_FS_WIN32 != '\0'
    lv_fs_win32_init();
#endif

#if LV_USE_FS_MEMFS
    lv_fs_memfs_init();
#endif

#if LV_USE_FS_LITTLEFS
    lv_fs_littlefs_init();
#endif

#if LV_USE_LODEPNG
    lv_lodepng_init();
#endif

#if LV_USE_LIBPNG
    lv_libpng_init();
#endif

#if LV_USE_TJPGD
    lv_tjpgd_init();
#endif

#if LV_USE_LIBJPEG_TURBO
    lv_libjpeg_turbo_init();
#endif

#if LV_USE_BMP
    lv_bmp_init();
#endif

    /*Make FFMPEG last because the last converter will be checked first and
     *it's superior to any other */
#if LV_USE_FFMPEG
    lv_ffmpeg_init();
#endif

#if LV_USE_FREETYPE
    /*Init freetype library*/
    lv_freetype_init(LV_FREETYPE_CACHE_FT_GLYPH_CNT);
#endif

#if LV_USE_TINY_TTF
    lv_tiny_ttf_init();
#endif

#if LV_USE_QUAJPEG
    lv_quajpeg_init();
#endif

#if LV_USE_QUAPNG
    lv_quapng_init();
#endif

#if !defined(BUILD_SIMULATOR) || BUILD_SIMULATOR == 0
    if (qua_mm_init(QUA_FALSE, qua_mm_get_platform(), &g_lvgl_mm_system) != QUA_SUCCESS) {
        LV_LOG_ERROR("lv_init quamm system init failed");
    }
#endif

    lv_initialized = true;

    LV_LOG_TRACE("finished");
}

void lv_deinit(void)
{
    /*Do nothing if already deinit*/
    if(!lv_initialized) {
        LV_LOG_WARN("lv_deinit: already deinit!");
        return;
    }

    if(lv_deinit_in_progress) return;

    lv_deinit_in_progress = true;

#if LV_USE_SYSMON
    _lv_sysmon_builtin_deinit();
#endif

    lv_display_set_default(NULL);

    _lv_cleanup_devices(LV_GLOBAL_DEFAULT());

#if LV_USE_SPAN != 0
    lv_span_stack_deinit();
#endif

#if LV_USE_DRAW_SW
    lv_draw_sw_deinit();
#endif

#if LV_USE_FREETYPE
    lv_freetype_uninit();
#endif

#if LV_USE_TINY_TTF
    lv_tiny_ttf_deinit();
#endif

#if LV_USE_THEME_DEFAULT
    lv_theme_default_deinit();
#endif

#if LV_USE_THEME_SIMPLE
    lv_theme_simple_deinit();
#endif

#if LV_USE_THEME_MONO
    lv_theme_mono_deinit();
#endif

    _lv_image_decoder_deinit();

    _lv_refr_deinit();

    _lv_obj_style_deinit();

#if LV_USE_DRAW_PXP
    lv_draw_pxp_deinit();
#endif

#if LV_USE_DRAW_VGLITE
    lv_draw_vglite_deinit();
#endif

#if LV_USE_DRAW_VG_LITE
    lv_draw_vg_lite_deinit();
#endif

#if LV_USE_DRAW_SW
    lv_draw_sw_deinit();
#endif

    lv_draw_deinit();

    _lv_group_deinit();

    _lv_anim_core_deinit();

    _lv_layout_deinit();

    _lv_fs_deinit();

    _lv_timer_core_deinit();

#if LV_USE_PROFILER && LV_USE_PROFILER_BUILTIN
    lv_profiler_builtin_uninit();
#endif

#if LV_USE_OBJ_ID_BUILTIN
    lv_objid_builtin_destroy();
#endif

    lv_mem_deinit();

    lv_initialized = false;

    LV_LOG_INFO("lv_deinit done");

#if LV_USE_LOG
    lv_log_register_print_cb(NULL);
#endif

}

/**********************
 *   STATIC FUNCTIONS
 **********************/
