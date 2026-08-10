# LVGL source trim for PC SDL preview.
# Product LVGL is xos-package/lvgl (QM fork). Release must stage that tree —
# never a stock/Beken hybrid with orphan blend formats (al88/l8/…) that still
# reference removed typedef names (lv_draw_sw_blend_fill_dsc_t vs _lv_…).
function(optimize_lvgl_drivers)
    if(NOT TARGET lvgl)
        message(WARNING "LVGL target not found, skipping driver optimization")
        return()
    endif()

    get_target_property(LVGL_SOURCES lvgl SOURCES)
    if(NOT LVGL_SOURCES)
        message(WARNING "Could not get LVGL sources")
        return()
    endif()

    list(LENGTH LVGL_SOURCES ORIGINAL_COUNT)

    set(EXCLUDED_DRIVERS
        # Non-SDL display / input / OS backends
        ".*/drivers/display/.*"
        ".*/drivers/glfw/.*"
        ".*/drivers/evdev/.*"
        ".*/drivers/libinput/.*"
        ".*/drivers/nuttx/.*"
        ".*/drivers/qnx/.*"
        ".*/drivers/uefi/.*"
        ".*/drivers/wayland/.*"
        ".*/drivers/windows/.*"
        ".*/drivers/x11/.*"
        ".*/others/xml/.*"
        # GPU / SoC draw backends (not used by PC SDL soft render)
        ".*/draw/dma2d/.*"
        ".*/draw/nema_gfx/.*"
        ".*/draw/nxp/.*"
        ".*/draw/renesas/.*"
        ".*/draw/vg_lite/.*"
        ".*/draw/opengles/.*"
        ".*/draw/sdl/.*"
        ".*/others/vg_lite_tvg/.*"
        # xos / Quaming device-only
        ".*/draw/sw/blend/qua/.*"
        ".*/draw/xos/.*"
        ".*/libs/quajpeg/.*"
        ".*/libs/quapng/.*"
        ".*/libs/ffmpeg/.*"
        ".*/libs/rlottie/.*"
        # Orphan stock blend units (absent in product xos tree; if present they
        # often still use pre-QM typedef names and break MSVC).
        ".*/draw/sw/blend/lv_draw_sw_blend_to_al88\\..*"
        ".*/draw/sw/blend/lv_draw_sw_blend_to_l8\\..*"
        ".*/draw/sw/blend/lv_draw_sw_blend_to_i1\\..*"
        ".*/draw/sw/blend/lv_draw_sw_blend_to_rgb565_swapped\\..*"
        ".*/draw/sw/blend/lv_draw_sw_blend_to_argb8888_premultiplied\\..*"
        # Neon / Helium / Arm-2D asm paths (device)
        ".*/draw/sw/blend/neon/.*"
        ".*/draw/sw/blend/helium/.*"
        ".*/draw/sw/blend/arm2d/.*"
    )

    foreach(PATTERN ${EXCLUDED_DRIVERS})
        list(FILTER LVGL_SOURCES EXCLUDE REGEX "${PATTERN}")
    endforeach()

    list(LENGTH LVGL_SOURCES OPTIMIZED_COUNT)
    set_target_properties(lvgl PROPERTIES SOURCES "${LVGL_SOURCES}")

    math(EXPR SAVED_COUNT "${ORIGINAL_COUNT} - ${OPTIMIZED_COUNT}")
    message(STATUS "LVGL Source Optimization: ${ORIGINAL_COUNT} -> ${OPTIMIZED_COUNT} (-${SAVED_COUNT})")
endfunction()

optimize_lvgl_drivers()
