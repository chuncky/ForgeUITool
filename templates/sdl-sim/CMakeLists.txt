cmake_minimum_required(VERSION 3.16)

find_program(CCACHE_PROGRAM ccache)
if(CCACHE_PROGRAM)
  message(STATUS "Using ccache: ${CCACHE_PROGRAM}")
  set(CMAKE_C_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
  set(CMAKE_CXX_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
endif()

project(forgeui_preview C CXX)
set(CMAKE_C_STANDARD 99)

if(NOT FORGEUI_PROJECT_ROOT)
  message(FATAL_ERROR "FORGEUI_PROJECT_ROOT must point to the ForgeUI project directory")
endif()
if(NOT FORGEUI_LVGL_ROOT)
  message(FATAL_ERROR "FORGEUI_LVGL_ROOT must point to LVGL 9.x sources")
endif()

if(NOT FORGEUI_CODEGEN_DIR)
  set(FORGEUI_CODEGEN_DIR "${FORGEUI_PROJECT_ROOT}/forgeui_generated")
endif()

set(LVGL_DIR ${FORGEUI_LVGL_ROOT})
if(EXISTS "${LVGL_DIR}/lvgl/lvgl.h")
  set(LVGL_INCLUDE_ROOT "${LVGL_DIR}")
  set(LVGL_DIR "${LVGL_DIR}/lvgl")
elseif(EXISTS "${LVGL_DIR}/lvgl.h")
  get_filename_component(LVGL_INCLUDE_ROOT "${LVGL_DIR}" DIRECTORY)
else()
  message(FATAL_ERROR "Invalid FORGEUI_LVGL_ROOT: ${FORGEUI_LVGL_ROOT}")
endif()

# --- SDL2 must be ready before LVGL (lvgl compiles SDL drivers when LV_USE_SDL=1) ---
set(_forgeui_sdl2_found FALSE)

if(FORGEUI_SDL2_ROOT)
  list(PREPEND CMAKE_PREFIX_PATH "${FORGEUI_SDL2_ROOT}")
endif()

find_package(SDL2 QUIET)
if(SDL2_FOUND)
  set(_forgeui_sdl2_found TRUE)
endif()

if(NOT _forgeui_sdl2_found AND FORGEUI_REPO_ROOT)
  set(_sdl_src_candidates
    "${FORGEUI_REPO_ROOT}/third_party/SDL2-2.30.11"
    "${FORGEUI_REPO_ROOT}/third_party/SDL"
  )
  foreach(_cand IN LISTS _sdl_src_candidates)
    if(EXISTS "${_cand}/CMakeLists.txt")
      message(STATUS "Building SDL2 from ${_cand}")
      set(SDL_SHARED ON CACHE BOOL "" FORCE)
      set(SDL_STATIC OFF CACHE BOOL "" FORCE)
      set(SDL_TEST OFF CACHE BOOL "" FORCE)
      set(SDL_INSTALL OFF CACHE BOOL "" FORCE)
      add_subdirectory("${_cand}" "${CMAKE_BINARY_DIR}/sdl2-src")
      set(_forgeui_sdl2_found TRUE)
      break()
    endif()
  endforeach()
endif()

if(NOT _forgeui_sdl2_found)
  message(FATAL_ERROR
    "SDL2 not found.\n"
    "  1) Run: npm run fetch:sdl\n"
    "  2) Or set FORGEUI_SDL2_ROOT to an SDL2 install prefix")
endif()

# lv_conf.h lives in this preview-build dir (copied from templates/sdl-sim).
# Must be visible to the *lvgl* target itself (not only forgeui_preview), or MSVC
# fails with C1083 on lv_conf.h when rebuilding LVGL after clean/reconfigure.
set(LV_CONF_INCLUDE_SIMPLE ON CACHE BOOL "Use #include \"lv_conf.h\"" FORCE)
# Skip xos device-only qua_mm / syscall paths in lv_init.c.
set(BUILD_SIMULATOR 1 CACHE STRING "ForgeUI PC SDL preview" FORCE)

add_subdirectory(${LVGL_DIR} lvgl_build)
target_link_libraries(lvgl PUBLIC SDL2::SDL2)
target_include_directories(lvgl PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}"
  "${LVGL_INCLUDE_ROOT}"
)
target_compile_definitions(lvgl PUBLIC
  LV_CONF_INCLUDE_SIMPLE
  BUILD_SIMULATOR=1
)
if(FORGEUI_SDL2_ROOT AND EXISTS "${FORGEUI_SDL2_ROOT}/include/SDL2/SDL.h")
  target_include_directories(lvgl PUBLIC "${FORGEUI_SDL2_ROOT}/include")
endif()
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/optimize_drivers.cmake")
  include(${CMAKE_CURRENT_SOURCE_DIR}/optimize_drivers.cmake)
endif()

include("${FORGEUI_CODEGEN_DIR}/forgeui_generated.cmake")

add_executable(forgeui_preview WIN32
  main.c
  hal.c
  ${FORGEUI_GENERATOR_SOURCES}
)

target_include_directories(forgeui_preview PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${FORGEUI_GENERATOR_INCLUDE_DIRS}
  ${LVGL_INCLUDE_ROOT}
  ${LVGL_DIR}
  ${LVGL_DIR}/src
)

target_compile_definitions(forgeui_preview PRIVATE LV_CONF_INCLUDE_SIMPLE FORGEUI_HAS_SDL=1)
target_link_libraries(forgeui_preview PRIVATE lvgl SDL2::SDL2)
if(MINGW OR CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
  target_link_libraries(forgeui_preview PRIVATE stdc++)
endif()

if(MSVC)
  target_link_options(forgeui_preview PRIVATE "/ENTRY:mainCRTStartup")
endif()

if(WIN32)
  if(FORGEUI_SDL2_ROOT AND EXISTS "${FORGEUI_SDL2_ROOT}/bin/SDL2.dll")
    add_custom_command(TARGET forgeui_preview POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${FORGEUI_SDL2_ROOT}/bin/SDL2.dll"
        $<TARGET_FILE_DIR:forgeui_preview>
    )
  elseif(TARGET SDL2::SDL2)
    get_target_property(_sdl2_loc SDL2::SDL2 IMPORTED_LOCATION)
    if(_sdl2_loc)
      get_filename_component(_sdl2_dir "${_sdl2_loc}" DIRECTORY)
      if(EXISTS "${_sdl2_dir}/SDL2.dll")
        add_custom_command(TARGET forgeui_preview POST_BUILD
          COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${_sdl2_dir}/SDL2.dll"
            $<TARGET_FILE_DIR:forgeui_preview>
        )
      endif()
    endif()
  elseif(TARGET SDL2)
    add_custom_command(TARGET forgeui_preview POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy_if_different $<TARGET_FILE:SDL2> $<TARGET_FILE_DIR:forgeui_preview>
    )
  endif()
  if(EXISTS "${CMAKE_BINARY_DIR}/sdl2-src/Debug/SDL2d.dll")
    add_custom_command(TARGET forgeui_preview POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_BINARY_DIR}/sdl2-src/Debug/SDL2d.dll"
        $<TARGET_FILE_DIR:forgeui_preview>
    )
  elseif(EXISTS "${CMAKE_BINARY_DIR}/sdl2-src/Release/SDL2.dll")
    add_custom_command(TARGET forgeui_preview POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_BINARY_DIR}/sdl2-src/Release/SDL2.dll"
        $<TARGET_FILE_DIR:forgeui_preview>
    )
  endif()
endif()
