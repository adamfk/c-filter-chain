#include "i32-filter-chain.h"
#include "fc_Mallocator.h"

//TODO test from CPP to ensure that it agrees
fc32_FilterChain* buildChain1(void)
{
  fc_BuilderConfig* bc = &(fc_BuilderConfig){
    .allocator = &fc_Mallocator,
  };

  fc32_FilterChain* filter_chain = fc32_FilterChain_new(bc,
    LIST_START(32)
    fcb32_DownSampler_new_gb(bc, 0, 2,
      LIST_START(32)
      fcb32_IirLowPass1_new_gb(bc, 0.5),
      LIST_END
    ),
    LIST_END
  );

  return filter_chain;
}
