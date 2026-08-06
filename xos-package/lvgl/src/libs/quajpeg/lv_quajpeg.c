/*
 * Copyright (c) 2025 Quaming Intelligent Technology Co., Ltd.
 *
 * All Rights Reserved.
 * Confidential and Proprietary - Quaming Intelligent Technology Co., Ltd.
 */

#include "../../../lvgl.h"
#if LV_USE_QUAJPEG

#include <stdio.h>

#include "quagl_lvgl_adapter.h"

static lv_result_t wrap_quajpeg_decoder_open(lv_image_decoder_t *decoder, lv_image_decoder_dsc_t *dsc) {
    lv_result_t result = lv_quajpeg_decoder_open(decoder, dsc);

    if (result != LV_RESULT_OK) {
        if (dsc != NULL && dsc->src_type == LV_IMAGE_SRC_FILE) {
            LV_LOG_WARN("quajpeg open failed src=%s", (const char *)dsc->src);
        } else {
            LV_LOG_WARN("quajpeg open failed src=%p", dsc != NULL ? dsc->src : NULL);
        }
    }
    else {
        qua_hw_jpeg_decoder_instance_t *instance = (qua_hw_jpeg_decoder_instance_t *)dsc->user_data;
        if (qua_check_chip(QUA_SYS_CHIP_QM10XV)) {
#if LV_CACHE_DEF_SIZE > 0
            lv_image_cache_data_t search_key;
            search_key.src_type = dsc->src_type;
            search_key.src = dsc->src;
            search_key.slot.size = dsc->decoded->data_size;

            lv_cache_entry_t * cache_entry = lv_image_decoder_add_to_cache(decoder, &search_key, dsc->decoded, instance->gl_buffer);
            if(cache_entry != NULL) {
                dsc->cache_entry = cache_entry;
                instance->gl_buffer = NULL; /*Cache will take care of it*/
            }
#endif
        }
    }

    return result;
}

static QUA_VOID wrap_quajpeg_decoder_close(lv_image_decoder_t *decoder, lv_image_decoder_dsc_t *dsc) {
    lv_quajpeg_decoder_close(decoder, dsc);
    if(dsc->cache_entry)
        lv_cache_release(dsc->cache, dsc->cache_entry, NULL);
}

static QUA_VOID wrap_quajpeg_cache_free_cb(QUA_VOID_PTR node, QUA_VOID_PTR user_data) {
    lv_image_cache_data_t * entry = (lv_image_cache_data_t *)node;

    lv_quajpeg_cache_free_cb(node, user_data);
    if(entry->src_type == LV_IMAGE_SRC_FILE) lv_free((void *)entry->src);
}

/**
 * Register qua hardware jpeg decoder functions in lvgl.
 */
void lv_quajpeg_init(void) {
    printf("quajpeg init in\n");
    lv_image_decoder_t *dec = lv_image_decoder_create();
    lv_image_decoder_set_info_cb(dec, lv_quajpeg_decoder_info);
    lv_image_decoder_set_open_cb(dec, wrap_quajpeg_decoder_open);
    lv_image_decoder_set_close_cb(dec, wrap_quajpeg_decoder_close);
    lv_image_decoder_set_cache_free_cb(dec, wrap_quajpeg_cache_free_cb);
}

void lv_quajpeg_deinit(void) {
    printf("quajpeg deinit in\n");
    lv_image_decoder_t *dec = NULL;
    while((dec = lv_image_decoder_get_next(dec)) != NULL) {
        if(dec->info_cb == lv_quajpeg_decoder_info) {
            lv_image_decoder_delete(dec);
            break;
        }
    }
}

#endif // LV_USE_QUAJPEG
