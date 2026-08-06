/*
 * Copyright (c) 2025 Quaming Intelligent Technology Co., Ltd.
 *
 * All Rights Reserved.
 * Confidential and Proprietary - Quaming Intelligent Technology Co., Ltd.
 */

#ifndef __LV_QUAJPEG_H__
#define __LV_QUAJPEG_H__

#ifdef __cplusplus
extern "C" {
#endif

#include "../../lv_conf_internal.h"

#if LV_USE_QUAJPEG

/**
 * Register qua jpeg decoder functions in lvgl.
 */
void lv_quajpeg_init(void);
void lv_quajpeg_deinit(void);

#endif /* LV_USE_QUAJPEG */

#ifdef __cplusplus
}
#endif

#endif // __LV_QUAJPEG_H_