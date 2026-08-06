/**
 * @file lv_draw_sw_blend.c
 *
 */

/*********************
 *      INCLUDES
 *********************/
#include "../lv_draw_sw.h"
#include "lv_draw_sw_blend_to_rgb565.h"
#include "lv_draw_sw_blend_to_argb8888.h"
#include "lv_draw_sw_blend_to_rgb888.h"

#if LV_USE_DRAW_SW

/*********************
 *      DEFINES
 *********************/

/**********************
 *      TYPEDEFS
 **********************/

/**********************
 *  STATIC PROTOTYPES
 **********************/
/**********************
 *  STATIC VARIABLES
 **********************/

/**********************
 *      MACROS
 **********************/

/**********************
 *   GLOBAL FUNCTIONS
 **********************/

void lv_draw_sw_blend(lv_draw_unit_t * draw_unit, const lv_draw_sw_blend_dsc_t * blend_dsc)
{
    /*Do not draw transparent things*/
    if(blend_dsc->opa <= LV_OPA_MIN) return;
    if(blend_dsc->mask_buf && blend_dsc->mask_res == LV_DRAW_SW_MASK_RES_TRANSP) return;

    lv_area_t blend_area;
    if(!_lv_area_intersect(&blend_area, blend_dsc->blend_area, draw_unit->clip_area)) return;

    LV_PROFILER_BEGIN;
    lv_layer_t * layer = draw_unit->target_layer;
    uint32_t layer_stride_byte = lv_draw_buf_width_to_stride(lv_area_get_width(&layer->buf_area), layer->color_format);

    if(blend_dsc->src_buf == NULL) {
        _lv_draw_sw_blend_fill_dsc_t fill_dsc;
        fill_dsc.dest_w = lv_area_get_width(&blend_area);
        fill_dsc.dest_h = lv_area_get_height(&blend_area);
        fill_dsc.dest_stride = layer_stride_byte;
        fill_dsc.opa = blend_dsc->opa;
        fill_dsc.color = blend_dsc->color;
        fill_dsc.dest_buf_origin = lv_draw_layer_go_to_xy(layer, 0, 0);
        fill_dsc.blend_area = blend_area;
        fill_dsc.dest_layer_area = layer->buf_area;

#if 0
        printf("dsc origin %p fb origin %p layer buffer area [%d %d %d %d] blend area [%d %d %d %d]\n",
            fill_dsc.dest_buf_origin, _get_virtAddr(),
            layer->buf_area.x1, layer->buf_area.x2, layer->buf_area.y1, layer->buf_area.y2,
            blend_area.x1, blend_area.x2, blend_area.y1, blend_area.y2);
#endif

        if(blend_dsc->mask_buf == NULL) fill_dsc.mask_buf = NULL;
        else if(blend_dsc->mask_res == LV_DRAW_SW_MASK_RES_FULL_COVER) fill_dsc.mask_buf = NULL;
        else fill_dsc.mask_buf = blend_dsc->mask_buf;

        fill_dsc.dest_buf = lv_draw_layer_go_to_xy(layer, blend_area.x1 - layer->buf_area.x1,
                                                   blend_area.y1 - layer->buf_area.y1);

        if(fill_dsc.mask_buf) {
            fill_dsc.mask_stride = blend_dsc->mask_stride == 0  ? lv_area_get_width(blend_dsc->mask_area) : blend_dsc->mask_stride;
            fill_dsc.mask_buf += fill_dsc.mask_stride * (blend_area.y1 - blend_dsc->mask_area->y1) +
                                 (blend_area.x1 - blend_dsc->mask_area->x1);
        }
        // static int x = 0;
        // if (x++ % 48 == 0)
        //     printf("[color_blend]color_format:0x%x, mask_buf=%p. opa=%d. color=0x%0x\n", layer->color_format, fill_dsc.mask_buf, fill_dsc.opa, fill_dsc.color);
        switch(layer->color_format) {
            case LV_COLOR_FORMAT_RGB565:
                lv_draw_sw_blend_color_to_rgb565(&fill_dsc);
                break;
            case LV_COLOR_FORMAT_ARGB8888: {
                    lv_draw_sw_blend_color_to_argb8888(&fill_dsc);
                }
                break;
            case LV_COLOR_FORMAT_RGB888:
                lv_draw_sw_blend_color_to_rgb888(&fill_dsc, 3);
                break;
            case LV_COLOR_FORMAT_XRGB8888:
                lv_draw_sw_blend_color_to_rgb888(&fill_dsc, 4);
                break;
            default:
                break;
        }
    }
    else {
        if(!_lv_area_intersect(&blend_area, &blend_area, blend_dsc->src_area)) {
            LV_PROFILER_END;
            return;
        }

        if(blend_dsc->mask_area && !_lv_area_intersect(&blend_area, &blend_area, blend_dsc->mask_area)) {
            LV_PROFILER_END;
            return;
        }

        _lv_draw_sw_blend_image_dsc_t image_dsc;



        image_dsc.dest_w = lv_area_get_width(&blend_area);
        image_dsc.dest_h = lv_area_get_height(&blend_area);
        image_dsc.dest_stride = layer_stride_byte;

        image_dsc.opa = blend_dsc->opa;
        image_dsc.blend_mode = blend_dsc->blend_mode;
        image_dsc.src_stride = blend_dsc->src_stride;
        image_dsc.src_color_format = blend_dsc->src_color_format;

        //
        //image
        int src_buf_offset = 0;
        uint32_t src_px_size = lv_color_format_get_size(blend_dsc->src_color_format);
        src_buf_offset += image_dsc.src_stride * (blend_area.y1 - blend_dsc->src_area->y1);
        src_buf_offset += (blend_area.x1 - blend_dsc->src_area->x1) * src_px_size;
        image_dsc.src_buf_origin = blend_dsc->src_buf;
        image_dsc.src_phy_addr = blend_dsc->src_phy_addr;
        image_dsc.src_buf = ((uint8_t *)blend_dsc->src_buf + src_buf_offset);

        // LV_LOG_USER("blend_dsc->src_buf=%p, image_dsc.src_buf=%p", blend_dsc->src_buf, image_dsc.src_buf);
        image_dsc.src_size = blend_dsc->src_size;

        if(blend_dsc->mask_buf == NULL) {
            image_dsc.mask_buf = NULL;
        }
        else if(blend_dsc->mask_res == LV_DRAW_SW_MASK_RES_FULL_COVER) {
            image_dsc.mask_buf = NULL;
        }
        else {
            image_dsc.mask_buf = blend_dsc->mask_buf;
        }

        //
        if (image_dsc.mask_buf) {
            image_dsc.mask_stride = blend_dsc->mask_stride ? blend_dsc->mask_stride : lv_area_get_width(blend_dsc->mask_area);
            int mask_offset = image_dsc.mask_stride * (blend_area.y1 - blend_dsc->mask_area->y1) +
                                  (blend_area.x1 - blend_dsc->mask_area->x1);
            image_dsc.mask_buf += mask_offset;
        }

        image_dsc.dest_buf = lv_draw_layer_go_to_xy(layer, blend_area.x1 - layer->buf_area.x1,
                                                    blend_area.y1 - layer->buf_area.y1);
        image_dsc.dest_buf_origin = lv_draw_layer_go_to_xy(layer, 0, 0);
        image_dsc.dest_phy_addr = layer->draw_buf->phy_addr;
        image_dsc.src_area = (lv_area_t *)blend_dsc->src_area;
        lv_area_copy(&image_dsc.blend_area, &blend_area);
        image_dsc.dest_layer_area = &(layer->buf_area);
        switch(layer->color_format) {
            case LV_COLOR_FORMAT_RGB565:
            case LV_COLOR_FORMAT_RGB565A8:
                lv_draw_sw_blend_image_to_rgb565(&image_dsc);
                break;
            case LV_COLOR_FORMAT_ARGB8888:{
                lv_draw_sw_blend_image_to_argb8888(&image_dsc);
                break;
            }
            case LV_COLOR_FORMAT_RGB888:
                lv_draw_sw_blend_image_to_rgb888(&image_dsc, 3);
                break;
            case LV_COLOR_FORMAT_XRGB8888:
                lv_draw_sw_blend_image_to_rgb888(&image_dsc, 4);
                break;
            default:
                break;
        }
    }
    LV_PROFILER_END;
}

/**********************
 *   STATIC FUNCTIONS
 **********************/

#endif
