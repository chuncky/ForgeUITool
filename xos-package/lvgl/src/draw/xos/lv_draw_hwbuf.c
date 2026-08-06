/**
 * @file lv_draw_hwbuf.c
 */

#include "lv_draw_hwbuf.h"

#include "../../stdlib/lv_mem.h"

#if (!defined(BUILD_SIMULATOR) || BUILD_SIMULATOR == 0)
#include "qua_gui_accel.h"
#endif

#define LV_DRAW_HWBUF_FLAG LV_IMAGE_FLAGS_USER8

#if (!defined(BUILD_SIMULATOR) || BUILD_SIMULATOR == 0)

static qua_gui_format_t lv_draw_hwbuf_format(lv_color_format_t color_format)
{
    switch (color_format) {
    case LV_COLOR_FORMAT_ARGB8888:
        return QUA_GUI_FMT_ARGB8888;
    case LV_COLOR_FORMAT_XRGB8888:
        return QUA_GUI_FMT_XRGB8888;
    case LV_COLOR_FORMAT_RGB565:
        return QUA_GUI_FMT_RGB565;
    default:
        return QUA_GUI_FMT_INVALID;
    }
}

lv_result_t lv_draw_hwbuf_init(lv_draw_buf_t *draw_buf,
                               uint32_t capacity_width,
                               uint32_t capacity_height,
                               lv_color_format_t color_format,
                               const char *surface_name,
                               bool cacheable)
{
    qua_gui_surface_t surface;
    qua_gui_format_t format;
    uintptr_t data_offset;
    size_t data_size;
    int ret;

    if (!draw_buf || !capacity_width || !capacity_height)
        return LV_RESULT_INVALID;

    format = lv_draw_hwbuf_format(color_format);
    if (format == QUA_GUI_FMT_INVALID)
        return LV_RESULT_INVALID;

    lv_memzero(draw_buf, sizeof(*draw_buf));
    lv_memzero(&surface, sizeof(surface));
    ret = qua_gui_alloc_surface(surface_name, (int)capacity_width,
                                (int)capacity_height, format,
                                cacheable ? 1 : 0, &surface);
    if (ret != QUA_GUI_OK || !surface.virt || surface.stride_bytes <= 0) {
        if (surface.virt)
            qua_gui_free_surface(&surface);
        return LV_RESULT_INVALID;
    }

    data_size = (size_t)surface.stride_bytes * (size_t)surface.height;
    if (data_size > UINT32_MAX ||
        lv_draw_buf_init(draw_buf, capacity_width, capacity_height,
                         color_format, (uint32_t)surface.stride_bytes,
                         surface.virt, (uint32_t)data_size) != LV_RESULT_OK) {
        qua_gui_free_surface(&surface);
        lv_memzero(draw_buf, sizeof(*draw_buf));
        return LV_RESULT_INVALID;
    }

    data_offset = (uintptr_t)draw_buf->data - (uintptr_t)surface.virt;
    draw_buf->phy_addr = surface.phys ? surface.phys + (unsigned long)data_offset : 0;
    draw_buf->cacheable = surface.cacheable ? 1 : 0;
    draw_buf->header.flags |= LV_IMAGE_FLAGS_MODIFIABLE | LV_DRAW_HWBUF_FLAG;
    return LV_RESULT_OK;
}

lv_result_t lv_draw_hwbuf_deinit(lv_draw_buf_t *draw_buf)
{
    qua_gui_surface_t surface;
    int ret;

    if (!draw_buf)
        return LV_RESULT_INVALID;
    if (!draw_buf->unaligned_data && !draw_buf->data) {
        lv_memzero(draw_buf, sizeof(*draw_buf));
        return LV_RESULT_OK;
    }
    if (!(draw_buf->header.flags & LV_DRAW_HWBUF_FLAG))
        return LV_RESULT_INVALID;

    lv_memzero(&surface, sizeof(surface));
    ret = qua_gui_lookup_surface_by_virt(draw_buf->unaligned_data, &surface);
    if (ret != QUA_GUI_OK || !surface.priv)
        return LV_RESULT_INVALID;
    ret = qua_gui_free_surface(&surface);
    if (ret != QUA_GUI_OK)
        return LV_RESULT_INVALID;

    lv_memzero(draw_buf, sizeof(*draw_buf));
    return LV_RESULT_OK;
}

lv_result_t lv_draw_hwmem_alloc(const char *buffer_name,
                                uint32_t size,
                                bool cacheable,
                                unsigned long *out_phys,
                                void **out_virt)
{
    return qua_gui_alloc_memory(buffer_name, size, cacheable ? 1 : 0,
                                out_phys, out_virt) == QUA_GUI_OK
               ? LV_RESULT_OK
               : LV_RESULT_INVALID;
}

lv_result_t lv_draw_hwmem_free(unsigned long phys, void *virt)
{
    return qua_gui_free_memory(phys, virt) == QUA_GUI_OK
               ? LV_RESULT_OK
               : LV_RESULT_INVALID;
}

#else

lv_result_t lv_draw_hwbuf_init(lv_draw_buf_t *draw_buf,
                               uint32_t capacity_width,
                               uint32_t capacity_height,
                               lv_color_format_t color_format,
                               const char *surface_name,
                               bool cacheable)
{
    uint32_t stride;
    uint32_t data_size;
    void *data;

    (void)surface_name;
    (void)cacheable;

    if (!draw_buf || !capacity_width || !capacity_height)
        return LV_RESULT_INVALID;

    stride = lv_draw_buf_width_to_stride(capacity_width, color_format);
    if (!stride || capacity_height >
        (UINT32_MAX - (LV_DRAW_BUF_ALIGN - 1u)) / stride)
        return LV_RESULT_INVALID;

    data_size = stride * capacity_height + LV_DRAW_BUF_ALIGN - 1u;
    data = lv_malloc(data_size);
    if (!data)
        return LV_RESULT_INVALID;

    lv_memzero(draw_buf, sizeof(*draw_buf));
    if (lv_draw_buf_init(draw_buf, capacity_width, capacity_height,
                         color_format, stride, data, data_size) != LV_RESULT_OK) {
        lv_free(data);
        lv_memzero(draw_buf, sizeof(*draw_buf));
        return LV_RESULT_INVALID;
    }

    draw_buf->header.flags |= LV_IMAGE_FLAGS_MODIFIABLE | LV_DRAW_HWBUF_FLAG;
    return LV_RESULT_OK;
}

lv_result_t lv_draw_hwbuf_deinit(lv_draw_buf_t *draw_buf)
{
    if (!draw_buf)
        return LV_RESULT_INVALID;
    if (!draw_buf->unaligned_data && !draw_buf->data) {
        lv_memzero(draw_buf, sizeof(*draw_buf));
        return LV_RESULT_OK;
    }
    if (!(draw_buf->header.flags & LV_DRAW_HWBUF_FLAG))
        return LV_RESULT_INVALID;

    lv_free(draw_buf->unaligned_data);
    lv_memzero(draw_buf, sizeof(*draw_buf));
    return LV_RESULT_OK;
}

lv_result_t lv_draw_hwmem_alloc(const char *buffer_name,
                                uint32_t size,
                                bool cacheable,
                                unsigned long *out_phys,
                                void **out_virt)
{
    (void)buffer_name;
    (void)cacheable;

    if (!size || !out_phys || !out_virt)
        return LV_RESULT_INVALID;

    *out_phys = 0;
    *out_virt = lv_malloc(size);
    return *out_virt ? LV_RESULT_OK : LV_RESULT_INVALID;
}

lv_result_t lv_draw_hwmem_free(unsigned long phys, void *virt)
{
    (void)phys;

    if (!virt)
        return phys ? LV_RESULT_INVALID : LV_RESULT_OK;

    lv_free(virt);
    return LV_RESULT_OK;
}

#endif
