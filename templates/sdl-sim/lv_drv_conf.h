/**
 * @file lv_drv_conf.h
 * Stub for ForgeUI PC SDL preview.
 * Device/XOS builds supply the real header via XOS_INTERFACE_INC.
 */
#ifndef LV_DRV_CONF_H
#define LV_DRV_CONF_H

/* Optional overrides (see lv_indev.c); leave unset to use LVGL defaults. */
/* #define LV_CONFIG_LONG_PRESS_TIME 500 */
/* #define LV_CONFIG_USER_LONG_PRESS_TIME 1000 */

/** Power-key (LV_KEY_F3) long-press threshold used by xos lv_indev.c */
#ifndef LV_POWERKEY_TIMEOUT
#define LV_POWERKEY_TIMEOUT 2000
#endif

#endif /* LV_DRV_CONF_H */
