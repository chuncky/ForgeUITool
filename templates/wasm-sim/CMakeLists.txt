cmake_minimum_required(VERSION 3.16)
project(forgeui_preview_wasm C)
set(CMAKE_C_STANDARD 99)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Configure with emcmake (Emscripten toolchain required)")
endif()

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

set(_forgeui_sdl2_found FALSE)
if(FORGEUI_REPO_ROOT)
  set(_sdl_candidates
    "${FORGEUI_REPO_ROOT}/third_party/SDL2-2.30.11"
    "${FORGEUI_REPO_ROOT}/third_party/SDL"
  )
  foreach(_cand IN LISTS _sdl_candidates)
    if(EXISTS "${_cand}/CMakeLists.txt")
      message(STATUS "Building SDL2 for Emscripten from ${_cand}")
      set(SDL_SHARED OFF CACHE BOOL "" FORCE)
      set(SDL_STATIC ON CACHE BOOL "" FORCE)
      set(SDL_TEST OFF CACHE BOOL "" FORCE)
      set(SDL_INSTALL OFF CACHE BOOL "" FORCE)
      add_subdirectory("${_cand}" "${CMAKE_BINARY_DIR}/sdl2-src")
      set(_forgeui_sdl2_found TRUE)
      break()
    endif()
  endforeach()
endif()

if(NOT _forgeui_sdl2_found)
  message(FATAL_ERROR "SDL2 sources not found under FORGEUI_REPO_ROOT/third_party")
endif()

add_subdirectory(${LVGL_DIR} lvgl_build)
target_link_libraries(lvgl PUBLIC SDL2::SDL2)
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/optimize_drivers.cmake")
  include(${CMAKE_CURRENT_SOURCE_DIR}/optimize_drivers.cmake)
endif()

include("${FORGEUI_CODEGEN_DIR}/forgeui_generated.cmake")

add_executable(forgeui_preview_wasm main.c hal.c ${FORGEUI_GENERATOR_SOURCES})

target_include_directories(forgeui_preview_wasm PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${FORGEUI_GENERATOR_INCLUDE_DIRS}
  ${LVGL_INCLUDE_ROOT}
  ${LVGL_DIR}
  ${LVGL_DIR}/src
)

target_compile_definitions(forgeui_preview_wasm PRIVATE LV_CONF_INCLUDE_SIMPLE FORGEUI_HAS_SDL=1)
target_link_libraries(forgeui_preview_wasm PRIVATE lvgl SDL2::SDL2)

set(CMAKE_EXECUTABLE_SUFFIX ".html")
set_target_properties(forgeui_preview_wasm PROPERTIES
  OUTPUT_NAME "forgeui_preview"
  LINK_FLAGS "-s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s ENVIRONMENT=web -s NO_EXIT_RUNTIME=1 -s ASSERTIONS=1"
)
