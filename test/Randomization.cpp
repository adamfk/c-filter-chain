#include "randomization.hpp"

time_t Randomization::seed;

void Randomization::init_seed_if_needed(void)
{
  if (seed == 0) {
    seed = time(0);
    srand((unsigned int)seed);
  }
}



