#include "randomization.hpp"
#include "gtest/gtest.h"

time_t Randomization::seed;

void Randomization::init_seed_if_needed(void)
{
  if (seed == 0) {
    seed = time(0);
    srand((unsigned int)seed);
  }
}




TEST(Randomization, no_exceptions) {

  for (size_t i = 0; i < 100; i++)
  {
    Randomization::get_for_type<bool>();
    Randomization::getBool();

    Randomization::get_for_type<int8_t>();
    Randomization::get_for_type<int16_t>();
    Randomization::get_for_type<int32_t>();
    Randomization::get_for_type<int64_t>();
    Randomization::get_for_type<uint8_t>();
    Randomization::get_for_type<uint16_t>();
    Randomization::get_for_type<uint32_t>();
    Randomization::get_for_type<uint64_t>();
    Randomization::get_for_type<float>();
    Randomization::get_for_type<double>();
  }
}


TEST(Randomization, bool_has_some) {
  int trueCount = 0;
  int falseCount = 0;

  for (size_t i = 0; i < 100; i++)
  {
    if (Randomization::getBool()) {
      trueCount++;
    } else {
      falseCount++;
    }
  }

  EXPECT_GE(trueCount, 30);
  EXPECT_GE(falseCount, 30);
}

