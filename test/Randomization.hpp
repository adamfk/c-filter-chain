#pragma once

#include <ctime>
#include <cstdlib>
#include <math.h>
#include <stdexcept>
#include <stdlib.h>

class Randomization {

  static time_t seed;
  static void init_seed_if_needed(void);

public:

  static int get_int(int min, int max) {
    init_seed_if_needed();
    if (min >= max) { throw std::runtime_error("min must be < max"); }
    int range = max - min;
    double zeroTo1 = 1.0 * rand() / RAND_MAX;
    int result = min + (int)(range * zeroTo1);
    return result;
  }


  template <typename PrimitiveType>
  static PrimitiveType get_for_type() {
    init_seed_if_needed();
    const PrimitiveType max = std::numeric_limits<PrimitiveType>::max();
    const PrimitiveType min = std::numeric_limits<PrimitiveType>::min();
    double range = 1.0 * max - min;           //mult by 1.0 to convert to double and avoid integer overflow issues.
    double temp = range * rand() / RAND_MAX;
    temp += min;
    PrimitiveType result = (PrimitiveType)temp;
    return result;
  }


  static void fill(void* address, size_t size)
  {
    uint8_t* to_fill = (uint8_t*)address;

    for (size_t i = 0; i < size; i++) {
      to_fill[i] = get_for_type<uint8_t>();
    }
  }


};

