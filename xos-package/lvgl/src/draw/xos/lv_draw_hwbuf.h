/**
 * @file lv_draw_hwbuf.h
 *
 * XOS hardware-capable draw buffer helpers.
 */

#ifndef LV_DRAW_HWBUF_H
#define LV_DRAW_HWBUF_H

#ifdef __cplusplus
extern "C" {
#endif

#include "../lv_draw_buf.h"

/*
 * Set cacheable for buffers written or read frequently by the CPU. The XOS
 * acceleration path performs the required cache maintenance before and after
 * hardware access. Use non-cacheable memory for hardware-only media buffers.
 */
lv_result_t lv_draw_hwbuf_init(lv_draw_buf_t *draw_buf,
                               uint32_t capacity_width,
                               uint32_t capacity_height,
                               lv_color_format_t color_format,
                               const char *surface_name,
                               bool cacheable);

lv_result_t lv_draw_hwbuf_deinit(lv_draw_buf_t *draw_buf);

/* Compatibility bridge for media APIs that still exchange raw phys/virt buffers. */
lv_result_t lv_draw_hwmem_alloc(const char *buffer_name,
                                uint32_t size,
                                bool cacheable,
                                unsigned long *out_phys,
                                void **out_virt);

lv_result_t lv_draw_hwmem_free(unsigned long phys, void *virt);

#ifdef __cplusplus
} /*extern "C"*/
#endif

#endif /*LV_DRAW_HWBUF_H*/
