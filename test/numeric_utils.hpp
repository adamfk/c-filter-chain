//modified from: https://stackoverflow.com/questions/17224256/function-checking-if-an-integer-type-can-fit-a-value-of-possibly-different-inte

#include <cmath> // necessary to check for floats too
#include <cstdint> // for testing only
#include <iomanip> // for testing only
#include <iostream> // for testing only
#include <limits> // necessary to check ranges
#include <type_traits> // necessary to check type properties (very efficient, compile time!)
#include <exception>


// the upper bound must always be checked
template <typename target_type, typename actual_type>
bool test_upper_bound(const actual_type n)
{
  typedef typename std::common_type<target_type, actual_type>::type common_type;
  const auto c_n = static_cast<common_type>(n);
  const auto t_max = static_cast<common_type>(std::numeric_limits<target_type>::max());
  return (c_n <= t_max);
}

// the lower bound is only needed to be checked explicitely in non-trivial cases, see the next to functions
template <typename target_type, typename actual_type>
typename std::enable_if<!(std::is_unsigned<target_type>::value), bool>::type
test_lower_bound(const actual_type n)
{
  typedef typename std::common_type<target_type, actual_type>::type common_type;
  const auto c_n = static_cast<common_type>(n);
  const auto t_min = static_cast<common_type>(std::numeric_limits<target_type>::lowest());
  return (c_n >= t_min);
}

// for unsigned target types, the sign of n musn't be negative
// but that's not an issue with unsigned actual_type
template <typename target_type, typename actual_type>
typename std::enable_if<std::is_integral<target_type>::value &&
  std::is_unsigned<target_type>::value &&
  std::is_integral<actual_type>::value &&
  std::is_unsigned<actual_type>::value, bool>::type
  test_lower_bound(const actual_type)
{
  return true;
}

// for unsigned target types, the sign of n musn't be negative
template <typename target_type, typename actual_type>
typename std::enable_if<std::is_integral<target_type>::value &&
  std::is_unsigned<target_type>::value &&
  (!std::is_integral<actual_type>::value ||
    !std::is_unsigned<actual_type>::value), bool>::type
  test_lower_bound(const actual_type n)
{
  return (n >= 0);
}

// value may be integral if the target type is non-integral
template <typename target_type, typename actual_type>
typename std::enable_if<!std::is_integral<target_type>::value, bool>::type
test_integrality(const actual_type)
{
  return true;
}

// value must be integral if the target type is integral
template <typename target_type, typename actual_type>
typename std::enable_if<std::is_integral<target_type>::value, bool>::type
test_integrality(const actual_type n)
{
  return ((std::abs(n - std::floor(n)) < 1e-8) || (std::abs(n - std::ceil(n)) < 1e-8));
}

// perform check only if non-trivial
template <typename target_type, typename actual_type>
typename std::enable_if<!std::is_same<target_type, actual_type>::value, bool>::type
CanTypeFitValue(const actual_type n)
{
  return test_upper_bound<target_type>(n) &&
    test_lower_bound<target_type>(n) &&
    test_integrality<target_type>(n);
}


// trivial case: actual_type == target_type
template <typename actual_type>
bool CanTypeFitValue(const actual_type)
{
  return true;
}



//Adam's basic addition.
template <typename target_type, typename actual_type>
target_type TryConvertToFrom(const actual_type n)
{
  if (CanTypeFitValue<target_type>(n)) {
    return (target_type)n;
  }

  throw std::out_of_range( 
    std::string("Cannot safely convert from ") 
    + "{" + std::to_string(n) + "} to type "
    + "<" + typeid(target_type).name() + ">"
  );
}
