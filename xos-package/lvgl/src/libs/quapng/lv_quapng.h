/*
 * Copyright (c) 2025 Quaming Intelligent Technology Co., Ltd.
 *
 * All Rights Reserved.
 * Confidential and Proprietary - Quaming Intelligent Technology Co., Ltd.
 */

#ifndef __LV_QUAPNG_H__
#define __LV_QUAPNG_H__

#ifdef __cplusplus
extern "C" {
#endif

#include "../../lv_conf_internal.h"
#if LV_USE_QUAPNG

/**
 * Register the PNG decoder functions in LVGL
 */
void lv_quapng_init(void);

void lv_quapng_deinit(void);

/**********************
 *      MACROS
 **********************/

#endif /*LV_USE_QUAPNG*/

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /*LV_QUAPNG_H*/
