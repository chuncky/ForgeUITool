# LVGL driver trim for PC SDL preview (from Beken lv_port_pc_simulate)
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
        ".*/drivers/display/drm/.*"
        ".*/drivers/display/fb/.*"
        ".*/drivers/display/ft81x/.*"
        ".*/drivers/display/ili9341/.*"
        ".*/drivers/display/lcd/.*"
        ".*/drivers/display/renesas_glcdc/.*"
        ".*/drivers/display/st_ltdc/.*"
        ".*/drivers/display/st7735/.*"
        ".*/drivers/display/st7789/.*"
        ".*/drivers/display/st7796/.*"
        ".*/drivers/display/tft_espi/.*"
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
