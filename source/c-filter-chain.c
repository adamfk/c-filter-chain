
//don't include header if already done by the file that includes this file
#ifndef C_FILTER_CHAIN_C_SKIP_HEADER_INCLUDE
#include "c-filter-chain.h"
#endif

#include <string.h>

#define ZERO_STRUCT(my_struct)  memset(&(my_struct), 0, sizeof(my_struct));


void FilterChain_setup(FilterChain* fc)
{
  for (size_t i = 0; i < fc->block_count; i++)
  {
    GenericBlock* block = fc->blocks[i];
    block->function_table->setup(block);
  }
}


fc_Type FilterChain_filter(FilterChain* fc, fc_Type input)
{
  fc_Type output = 0;

  for (size_t i = 0; i < fc->block_count; i++)
  {
    GenericBlock* block = fc->blocks[i];
    block->function_table->filter(block, input); //TODOLOW could have blocks not store output as some may not need to remember anything. Nice having outputs per block though for quick tracing, but that could probably be handled by another function fine anyway.
    output = block->output;
    input = output;
  }

  return output;
}




#define PassThrough_ftable FC_MAKE_NAME(PassThrough_ftable)

const BlockFunctionTable PassThrough_ftable = {
  .filter = (GenericBlock_filter_t)PassThrough_filter,
  .setup = (GenericBlock_setup_t)PassThrough_setup,
};


void PassThrough_new(PassThrough* passThrough)
{
  ZERO_STRUCT(*passThrough);
  passThrough->block.function_table = &PassThrough_ftable;
}


void PassThrough_setup(PassThrough* passThrough)
{
  passThrough->block.output = 0;
}


void PassThrough_filter(PassThrough* passThrough, fc_Type input)
{
  passThrough->block.output = input;
}




#define IirLowPass1_ftable FC_MAKE_NAME(fc_IirLowPass1_ftable)

const BlockFunctionTable IirLowPass1_ftable = {
  .filter = (GenericBlock_filter_t)IirLowPass1_filter,
  .setup = (GenericBlock_setup_t)IirLowPass1_setup,
};


void IirLowPass1_new(IirLowPass1* iir)
{
  ZERO_STRUCT(*iir);
  iir->block.function_table = &IirLowPass1_ftable;
}


void IirLowPass1_setup(IirLowPass1* iir)
{
  iir->block.output = 0;
}


/**
 * Note that if this is an integer based IIR, the rounding errors can be substantial if the input
 * is small. Test with a step function and see if it reaches 100%.
 */
void IirLowPass1_filter(IirLowPass1* iir, fc_Type input)
{
  fc_Type last_output = iir->block.output;
  double output = iir->new_ratio * input + (1 - iir->new_ratio) * last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  iir->block.output = (fc_Type)(output + 0.5); //TODO make rounding type generic
}



//###################################################################33


#define DownSampler_ftable FC_MAKE_NAME(DownSampler_ftable)

const BlockFunctionTable DownSampler_ftable = {
  .filter = (GenericBlock_filter_t)DownSampler_filter,
  .setup = (GenericBlock_setup_t)DownSampler_setup,
};


void DownSampler_new(DownSampler* down_sampler)
{
  ZERO_STRUCT(*down_sampler);
  down_sampler->block.function_table = &DownSampler_ftable;
}


void DownSampler_setup(DownSampler* down_sampler)
{
  down_sampler->block.output = 0;
  FilterChain_setup(&down_sampler->sub_chain);
}


void DownSampler_filter(DownSampler* down_sampler, fc_Type input)
{
  down_sampler->sample_count++;

  if (down_sampler->sample_count >= down_sampler->sample_every_x)
  {
    down_sampler->block.output = FilterChain_filter(&down_sampler->sub_chain, input);
    down_sampler->sample_count = 0;
  }
}


