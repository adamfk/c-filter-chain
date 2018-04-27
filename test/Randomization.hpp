#pragma once

#include <ctime>
#include <cstdlib>
#include <math.h>
#include <stdexcept>
#include <stdlib.h>

/*

TODOLOW see if we can replace much of this class with std lib stuff like: http://en.cppreference.com/w/cpp/numeric/random/uniform_int_distribution
  but we need to support int8_t types as well.

TODO replace `rand()` usage with std::uniform_real_distribution http://en.cppreference.com/w/cpp/numeric/random/uniform_real_distribution

*/


class Randomization {

  static time_t seed;
  static void init_seed_if_needed(void);

public:

  /**
   * Returns a random double from 0.0 up to but not including 1.0: [0.0, 1.0)
   */
  static double zeroUpToOne() {
    double result = 1.0 * rand() / (RAND_MAX + 1);
    return result;
  }


  static double zeroToOne() {
    double result = 1.0 * rand() / RAND_MAX;
    return result;
  }


  //TODO convert to using long double

  static int get_int(int minInc, int maxInc) {
    init_seed_if_needed();
    if (minInc >= maxInc) { throw std::runtime_error("min must be < max"); }
    int numberCount = maxInc - minInc + 1; //how many numbers in range
    
    //Below +1 to account for integer truncation so that both min and max are inclusive
    int result = (int)(zeroUpToOne() * (numberCount + 1));
    result += minInc;
    return result;
  }



  /**
   * 
   * TODOLOW integra/floating are very different. Interesting to write a single generic function that handles both,
   * but it would be cleaner to specialize into two functions for integral types and floating point types
   */
  template <typename PrimitiveType>
  static PrimitiveType getInclusive(PrimitiveType minInclusive, PrimitiveType maxInclusive) 
  {
    PrimitiveType result;
    double range;
    double randomMultiplier;

    init_seed_if_needed();
    if (minInclusive >= maxInclusive) { throw std::runtime_error("min must be < max"); }
    if (std::isinf((double)minInclusive)) { throw std::runtime_error("min can't be INFINITY"); }
    if (std::isinf((double)maxInclusive)) { throw std::runtime_error("max can't be INFINITY"); }
    //if (std::is_same<PrimitiveType, bool>()) { throw std::runtime_error("don't use on bool. See `getBool()` instead."); }

    range = (double)(maxInclusive - minInclusive);  //cast for u/int64_t types

    switch (std::numeric_limits<PrimitiveType>::round_style) 
    {
      case std::round_toward_zero:
        range++;  //inc for rounding truncation
        randomMultiplier = zeroUpToOne();
        break;

      case std::round_to_nearest:
        randomMultiplier = zeroToOne();
        break;

      default:
        throw std::runtime_error("rounding style not supported");
    }
    
    //Because MSVC doesn't support long double, we need to handle case where double can't hold range.
    //In this case, range will be infinity. This will definitely happen if you pass the numeric limits of
    //double to this function.
    if (std::isinf(range)) {
      //split range about 0 and randomly use one or the other. Note: skews distribution if max != -min
      bool usePositiveRange = zeroToOne() >= 0.5;
      if (usePositiveRange) {
        minInclusive = 0;
        range = (double)(maxInclusive - 0);
      } else {
        range = (double)(0 - minInclusive);
      }
    }

    result = (PrimitiveType)(randomMultiplier * range);
    result += minInclusive;

    return result;
  }


  static bool getBool() {
    bool result;
    if (zeroToOne() >= 0.5) {
      result = true;
    } else {
      result = false;
    }
    return result;
  }


  //TODOLOW specialize template for bool to avoid warnings

  template <typename PrimitiveType>
  static PrimitiveType get_for_type() {
    init_seed_if_needed();
    PrimitiveType min = std::numeric_limits<PrimitiveType>::lowest();
    PrimitiveType max = std::numeric_limits<PrimitiveType>::max();

    PrimitiveType result = getInclusive(min, max);
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



