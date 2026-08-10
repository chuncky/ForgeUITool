#ifndef FORGEUI_CUSTOM_FUNC_H
#define FORGEUI_CUSTOM_FUNC_H

#ifdef __cplusplus
extern "C" {
#endif

/** User hooks — implement in custom_func.c; CodeGen never overwrites existing file. */
void forgeui_custom_init(void);
void forgeui_custom_deinit(void);

#ifdef __cplusplus
}
#endif

#endif
