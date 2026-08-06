LVGL_PATH ?= $(LVGL_DIR)/$(LVGL_DIR_NAME)
# $(error lvglpath=$(LVGL_PATH))
GUIENGINE_ASRCS += $(shell find $(LVGL_PATH)/src -type f -name '*.S')
GUIENGINE_CSRCS += $(shell find $(LVGL_PATH)/src -type f -name '*.c')
ifeq ($(CONFIG_XOS_USE_LVGL_DEMOS),true)
GUIENGINE_CSRCS += $(shell find $(LVGL_PATH)/demos -type f -name '*.c')
GUIENGINE_CSRCS += $(shell find $(LVGL_PATH)/examples -type f -name '*.c')
endif
CXXEXT := .cpp
GUIENGINE_CXXSRCS += $(shell find $(LVGL_PATH)/src -type f -name '*${CXXEXT}')

AFLAGS += "-I$(LVGL_PATH)"
CFLAGS += "-I$(LVGL_PATH)"
CXXFLAGS += "-I$(LVGL_PATH)"

# Build LVGL objects as position-independent code for shared linking.
CFLAGS += "-fpic"
CXXFLAGS += "-fpic"

CSRCS += $(GUIENGINE_CSRCS)
ASRCS += $(GUIENGINE_ASRCS)
CXXSRCS += $(GUIENGINE_CXXSRCS)
# include $(LVGL_DIR)/$(LVGL_DIR_NAME)/demos/lv_demos.mk
# include $(LVGL_DIR)/$(LVGL_DIR_NAME)/examples/lv_examples.mk
# include $(LVGL_DIR)/$(LVGL_DIR_NAME)/src/lv_src.mk
