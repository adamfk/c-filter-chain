#include "i32-filter-chain.h"


//TODO test from CPP to ensure that it agrees
fc32_FilterChain* buildChain1(void)
{
  fc32_FilterChain* filter_chain = fc32_FilterChain_malloc(
    LIST_START(32)
    fcb32_DownSampler_new_malloc_gb(0, 2,
      LIST_START(32)
      fcb32_IirLowPass1_new_malloc_gb(0.5),
      LIST_END
    ),
    LIST_END
  );

  return filter_chain;
}
