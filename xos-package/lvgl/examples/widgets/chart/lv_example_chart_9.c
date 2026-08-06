#include "../../lv_examples.h"
#if LV_USE_CHART && LV_DRAW_SW_COMPLEX && LV_BUILD_EXAMPLES

static   lv_chart_series_t * series_chart;
static   lv_chart_series_t * series_chart1;
static   lv_chart_series_t * series_chart2;

static void my_chart_timer_cb(lv_timer_t * timer)
{

    lv_obj_t * my_obj = lv_timer_get_user_data(timer);
 
    for(int i = 0;i < 20;++i)
    {
        lv_chart_set_next_value(my_obj, series_chart, 100+lv_rand(0, 200));
    }
 
    for(int i = 0;i < 20;++i)
    {
        lv_chart_set_next_value(my_obj, series_chart1, lv_rand(0, 100));
    }


    for(int i = 0;i < 20;++i)
    {
        lv_chart_set_next_value(my_obj, series_chart2, lv_rand(0, 20));
    }

}



static void lv_example_chart_9( void ){

    lv_obj_t * chart = lv_chart_create(lv_screen_active());
    lv_obj_set_size(chart, 400, 300);
    lv_obj_set_pos(chart, 400, 250);
    lv_chart_set_type(chart, LV_CHART_TYPE_BAR_OVERLAP);//LV_CHART_TYPE_TWO_IN_ONE_BAR  LV_CHART_TYPE_BAR
    lv_chart_set_point_count(chart,20);//图表上点的个数
    lv_chart_set_range(chart, LV_CHART_AXIS_PRIMARY_Y, 0, 300);

    series_chart = lv_chart_add_series(chart, lv_color_hex(0xff0000), LV_CHART_AXIS_PRIMARY_Y);
    series_chart1 = lv_chart_add_series(chart, lv_palette_main(LV_PALETTE_GREEN), LV_CHART_AXIS_PRIMARY_Y);
    series_chart2 = lv_chart_add_series(chart, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);

    lv_obj_set_style_pad_column(chart, 2, LV_PART_MAIN); 

    for(int i = 0;i < 20;++i)
    {
        lv_chart_set_next_value(chart, series_chart, 100+lv_rand(0, 200));
    }

     for(int i = 0;i < 20;++i)
     {
         lv_chart_set_next_value(chart, series_chart1, lv_rand(0, 100));
     }

     for(int i = 0;i < 20;++i)
     {
         lv_chart_set_next_value(chart, series_chart2, lv_rand(0, 20));
     }
    
     lv_timer_create(my_chart_timer_cb, 1000, chart);  // 初始延迟1000毫秒
}


#endif
