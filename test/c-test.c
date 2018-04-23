#include "all_types.h"
#include "fc_lib/fc_Mallocator.h"

//TODO test from CPP to ensure that it agrees
fc32_BlockChain* buildChain1(void)
{
  fc_Builder* bc = &(fc_Builder){ //compound literal. vs2015 will build, but intellisense shows error.
    .allocator = &fc_Mallocator,
  };

  fc32_BlockChain* filter_chain = fc32_BlockChain_new(bc,
    LIST_START(32)
    fc32_DownSampler_new_iblock(bc, 0, 2,
      LIST_START(32)
      fc32_IirLowPass_new_iblock(bc, 0.5),
      LIST_END
    ),
    LIST_END
  );

  return filter_chain;
}
