#include "TestCommon.hpp"
#include "all_types.h"

static float expected_higher_ratio;
static float expected_lower_ratio;

/**
 * Type of a function to create a new filter
 */
typedef std::function<fc32_IirAsymLowPass*(fc_Builder*)> new32_func_t;

static new32_func_t new_block32_func = [](fc_Builder* mb) {
  return fc32_IirAsymLowPass_new(mb, expected_higher_ratio, expected_lower_ratio);
};

static new32_func_t new_gb_block32_func = [](fc_Builder* mb) {
  return (fc32_IirAsymLowPass*)fc32_IirAsymLowPass_new_iblock(mb, expected_higher_ratio, expected_lower_ratio);
};


static void test_constructed_state(void* iblock) {
  static_assert(sizeof(fc32_IirAsymLowPass) == sizeof(IBlock) + sizeof(float) * 2 + sizeof(int32_t), "struct changed. update test");
  fc32_IirAsymLowPass* block = (fc32_IirAsymLowPass*)iblock;
  EXPECT_EQ(block->higher_ratio, expected_higher_ratio);
  EXPECT_EQ(block->lower_ratio, expected_lower_ratio);
  EXPECT_EQ(block->last_output, 0);
}

static void setup_random_state_expectations() {
  expected_higher_ratio = Randomization::get_for_type<float>();
  expected_lower_ratio = Randomization::get_for_type<float>();
}

static void zero_state_expectations() {
  expected_higher_ratio = 0;
  expected_lower_ratio = 0;
}


//###############################################################################




TEST(fc32_IirAsymLowPass, _ctor) {
  zero_state_expectations();
  fc32_IirAsymLowPass p1;
  fc32_IirAsymLowPass_ctor(&p1);
  TestCommon::test_iblock_constructed(&p1);
  test_constructed_state(&p1);
}


//###############################################################################


TEST(fc32_IirAsymLowPass, _step_0_coefficients)
{
  TestCommon::run_with_mb( [](fc_Builder* mb) {
    const int32_t init_value = 6468;
    fc32_IirAsymLowPass* p1 = fc32_IirAsymLowPass_new(mb, 0, 0);
    fc32_IirAsymLowPass_preload(p1, init_value);
    vector<int32_t> inputs = { 235, 5325, 57575, 455 };
    vector<int32_t> outputs = { init_value };
    //TestCommon::xtest_block(p1, inputs, outputs);
  });
}


TEST(fc32_IirAsymLowPass, _step_climb_only) {
  TestCommon::run_with_mb([](fc_Builder* mb) {
    const int32_t init_value = 10;
    fc32_IirAsymLowPass* p1 = fc32_IirAsymLowPass_new(mb, 0.5f, 0);
    fc32_IirAsymLowPass_preload(p1, init_value);

    vector<InputOutput<int32_t>> steps = {
      InputOutput<int32_t>{  4, 10 }, //input less than last output, so will stay
      InputOutput<int32_t>{  9, 10 }, //input less than last output, so will stay
      InputOutput<int32_t>{ 20, 15 }, //input > than last output, so it will rise 50% the difference
      InputOutput<int32_t>{ 25, 20 }, //input > than last output, so it will rise 50% the difference
      InputOutput<int32_t>{  0, 20 }, //input less than last output, so it will stay
      InputOutput<int32_t>{ 30, 25 }, //input > than last output, so it will rise 50% the difference
    };

    TestCommon::test_steps(p1, steps);
  });
}


TEST(fc32_IirAsymLowPass, _new_step_fall_only) {
  TestCommon::run_with_mb([](fc_Builder* mb) {
    const int32_t init_value = 50;
    fc32_IirAsymLowPass* p1 = fc32_IirAsymLowPass_new(mb, 0, 0.5f);
    fc32_IirAsymLowPass_preload(p1, init_value);

    vector<InputOutput<int32_t>> steps = {
      InputOutput<int32_t>{ 88, 50 }, //input above last output, so will stay
      InputOutput<int32_t>{ 55, 50 }, //input above last output, so will stay
      InputOutput<int32_t>{ 40, 45 }, //input < than last output, so it will drop 50% the difference
      InputOutput<int32_t>{ 35, 40 }, //input < than last output, so it will drop 50% the difference
      InputOutput<int32_t>{ 30, 35 }, //input < than last output, so it will drop 50% the difference
      InputOutput<int32_t>{ 77, 35 }, //input above last output, so will stay
    };

    TestCommon::test_steps(p1, steps);
  });
}
