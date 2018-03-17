
#include "i32-filter-chain.h"
#include "i32-filter-chain.h" //note no problems doing this
#include "i8-filter-chain.h"

#include <stdio.h>

/**
* Macro for getting the size of an array that is known at compile time. Code from Google's Chromium project.
* Taken from http://stackoverflow.com/questions/4415524/common-array-length-macro-for-c
*
* Helps guard against taking the size of a pointer to an array and some other C++ stuff;
*/
#define COUNT_OF(x) ((sizeof(x)/sizeof(0[x])) / ((size_t)(!(sizeof(x) % sizeof(0[x])))))

int main(void) {


  fcb_PassThroughBlock_int32_t p32;
  fcb_PassThroughBlock_new_int32_t(&p32);

  fcb_IirLowPass1_int32_t iir32;
  fcb_IirLowPass1_new_int32_t(&iir32);
  iir32.new_ratio = 0.20f;

  fc_FilterChain_int32_t fc32 = { 0 };
  fcb_GenericBlock_int32_t* blocks[] = {
    &iir32.block,
    &p32.block,
  };

  fc32.blocks = &blocks[0];
  fc32.block_count = COUNT_OF(blocks);
  fc_FilterChain_setup_int32_t(&fc32);

  for (size_t i = 0; i < 50; i++)
  {
    int32_t output = fc_FilterChain_filter_int32_t(&fc32, 1000);
    printf("step %i, output %d\n", i, output);
  }



  fcb_IirLowPass1_int8_t iir8;
  fcb_IirLowPass1_new_int8_t(&iir8);

}
