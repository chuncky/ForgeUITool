# Test fixtures

## `forgeui-test.ttf` (optional)

Place a small open-licensed TTF here to run `tests/font_conv_e2e.test.ts` on CI/Linux/macOS.

On Windows the test falls back to `%WINDIR%\Fonts\consola.ttf` when this file is absent.

Set `FORGEUI_FONT_E2E=0` to skip the E2E test entirely.

Set `FORGEUI_TEST_TTF=/path/to/font.ttf` to override the font path.
