
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


  fcb32_PassThrough p32;
  fcb32_PassThrough_new(&p32);

  fcb32_IirLowPass1 iir32;
  fcb32_IirLowPass1_new(&iir32);
  iir32.new_ratio = 0.20f;

  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &iir32.block,
    &p32.block,
  };

  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);

  for (size_t i = 0; i < 50; i++)
  {
    int32_t output = fc32_FilterChain_filter(&filter_chain, 1000);
    printf("step %i, output %d\n", i, output);
  }



  fcb32_IirLowPass1 iir8;
  fcb32_IirLowPass1_new(&iir8);

}
