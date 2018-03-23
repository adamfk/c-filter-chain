
//don't include header if already done by the file that includes this file
#ifndef C_FILTER_CHAIN_C_SKIP_HEADER_INCLUDE
#include "c-filter-chain.h"
#endif

#include <string.h>
#include <stdarg.h>
#include <stdlib.h>

#define cfc_Malloc CFC_MALLOC_FUNC
#define cfc_Free CFC_FREE_FUNC

#define ZERO_STRUCT(my_struct)  memset(&(my_struct), 0, sizeof(my_struct));


static void* malloc_then_func_or_ret_fail_ptr(size_t size, void(*success_function)(void* allocated_object))
{
  void* p = cfc_Malloc(size);

  if (p == NULL) {
    p = CF_ALLOCATE_FAIL_PTR;
  }
  else {
    success_function(p);
  }

  return p;
}


static uint16_t count_null_term_var_arg_ptrs(va_list list)
{
  uint16_t count = 0;
  void* ptr = va_arg(list, void*);
  while (ptr != NULL)
  {
    count++;
    ptr = va_arg(list, void*);
  }

  return count;
}


/**
 * Returns true if found sign of a block allocation failure.
 * Copies all blocks regardless of block allocation failure detection.
 */
static bool test_and_copy_arg_blocks(GenericBlock** block_array, va_list block_list, size_t block_count)
{
  bool passed_block_allocate_fail = false;
  GenericBlock* block;

  for (size_t i = 0; i < block_count; i++)
  {
    block = va_arg(block_list, GenericBlock*);
    if (block == CF_ALLOCATE_FAIL_PTR)
    {
      //mark flag, BUT MUST CONTINUE!
      //we need to copy all in case of one allocation failure
      //so that we can destruct them all
      passed_block_allocate_fail = true;
    }
    block_array[i] = block;
  }

  return passed_block_allocate_fail;
}


static void destruct_blocks(GenericBlock** blocks, size_t block_count)
{
  for (size_t i = 0; i < block_count; i++)
  {
    GenericBlock* block = blocks[i];
    if (block != NULL && block != CF_ALLOCATE_FAIL_PTR)
    {
      GenericBlock_destruct_t destruct_function = block->function_table->destruct;
      destruct_function(block);
    }
  }
}



//####################################################################


/**
 * va_list MUST BE NULL TERMINATED!
 * You have to va_start the list before calling this.
 * Returns success
 */
bool FilterChain_malloc_inner(FilterChain* filter_chain, va_list block_list)
{
  bool success = false;
  bool passed_block_allocate_fail = false;
  uint16_t block_count;  //TODO make a typedef for chain blocks count size
  GenericBlock** block_array;

  va_list list_for_counting;

  //copy the list to count var args
  va_copy(list_for_counting, block_list); //NOTE!
  block_count = count_null_term_var_arg_ptrs(list_for_counting);
  va_end(list_for_counting); //NOTE!

  //TODO consider using a C99 variable sized array on stack so that we don't have to split va_end calls

  //try to block array
  block_array = cfc_Malloc(block_count * sizeof(block_array[0]));
  if (block_array == NULL) {
    va_end(block_list); //NOTE!
    goto done;
  }
  passed_block_allocate_fail = test_and_copy_arg_blocks(block_array, block_list, block_count);
  va_end(block_list); //NOTE!

  filter_chain->blocks = block_array;
  filter_chain->block_count = block_count;

  if (passed_block_allocate_fail) {
    goto failure_free_all;
  }

  success = true;
  goto done;

failure_free_all:
  destruct_blocks(block_array, block_count);
  cfc_Free(block_array);
done:
  return success;
}



/**
 * varargs MUST BE NULL TERMINATED!
 * @dummy is not used, but required for using var args.
 * Variable arguments should all be of type GenericBlock* or NULL.
 * 
 * Could do this nicer if used C99 compound literal, but then no cpp support
 * which is very useful for testing and cpp devs.
 * 
 * TODO: consider making a function that tries to determine if a passed in block is bogus
 * to detect someone forgetting to NULL terminate the list.
 * 
 * Returns #CF_ALLOCATE_FAIL_PTR if this or a passed block failed allocation.
 */
FilterChain* FilterChain_malloc(uint8_t dummy, ...)
{
  FilterChain* filter_chain;
  bool success = true;
  va_list list;

  filter_chain = cfc_Malloc(sizeof(*filter_chain));
  if (filter_chain == NULL) {
    success = false;
  }
  else {
    va_start(list, dummy);
    success = FilterChain_malloc_inner(filter_chain, list);
    va_end(list);

    if (!success) {
      cfc_Free(filter_chain);
    }
  }

  if (!success) {
    filter_chain = CF_ALLOCATE_FAIL_PTR;
  }

  return filter_chain;
}


void FilterChain_destruct_inner(FilterChain* fc)
{
  destruct_blocks(fc->blocks, fc->block_count);
  cfc_Free(fc->blocks);
}

void FilterChain_destruct(FilterChain* fc)
{
  FilterChain_destruct_inner(fc);
  cfc_Free(fc);
}


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


//####################################################################


#define PassThrough_ftable FC_MAKE_NAME(PassThrough_ftable)

const BlockFunctionTable PassThrough_ftable = {
  .filter = (GenericBlock_filter_t)PassThrough_filter,
  .setup = (GenericBlock_setup_t)PassThrough_setup,
  .destruct = (GenericBlock_destruct_t)PassThrough_destruct,
};


void PassThrough_new(PassThrough* passThrough)
{
  ZERO_STRUCT(*passThrough);
  passThrough->block.function_table = &PassThrough_ftable;
}


/**
 * Returns #CF_ALLOCATE_FAIL_PTR on allocate failure.
 */
PassThrough* PassThrough_new_malloc()
{
  PassThrough* p = malloc_then_func_or_ret_fail_ptr(sizeof(PassThrough), PassThrough_new);
  return p;
}


void PassThrough_destruct(PassThrough* block)
{
  cfc_Free(block);
}


void PassThrough_setup(PassThrough* passThrough)
{
  passThrough->block.output = 0;
}


void PassThrough_filter(PassThrough* passThrough, fc_Type input)
{
  passThrough->block.output = input;
}



//####################################################################



#define IirLowPass1_ftable FC_MAKE_NAME(fc_IirLowPass1_ftable)

const BlockFunctionTable IirLowPass1_ftable = {
  .filter = (GenericBlock_filter_t)IirLowPass1_filter,
  .setup = (GenericBlock_setup_t)IirLowPass1_setup,
  .destruct = (GenericBlock_destruct_t)IirLowPass1_destruct,
};


void IirLowPass1_new(IirLowPass1* iir)
{
  ZERO_STRUCT(*iir);
  iir->block.function_table = &IirLowPass1_ftable;
}

IirLowPass1* IirLowPass1_new_malloc(float new_ratio)
{
  IirLowPass1* p = malloc_then_func_or_ret_fail_ptr(sizeof(IirLowPass1), IirLowPass1_new);
  
  if (p != CF_ALLOCATE_FAIL_PTR) {
    p->new_ratio = new_ratio;
  }

  return p;
}

void IirLowPass1_destruct(IirLowPass1* p)
{
  cfc_Free(p);
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
  .destruct = (GenericBlock_destruct_t)DownSampler_destruct,
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

/**
 * varargs MUST BE NULL TERMINATED!
 * SEE #FilterChain_new_malloc for usage.
 */
DownSampler* DownSampler_new_malloc(uint16_t sample_offset, uint16_t sample_every_x, ...)
{
  bool inner_malloc_success;
  va_list list;
  DownSampler* down_sampler;

  down_sampler = malloc_then_func_or_ret_fail_ptr(sizeof(DownSampler), DownSampler_new);
  if (down_sampler == CF_ALLOCATE_FAIL_PTR) {
    goto done;
  }

  down_sampler->sample_every_x = sample_every_x;
  down_sampler->sample_count = sample_offset;

  va_start(list, sample_every_x);
  inner_malloc_success = FilterChain_malloc_inner(&down_sampler->sub_chain, list);
  va_end(list);

  if (!inner_malloc_success) {
    cfc_Free(down_sampler);
    down_sampler = CF_ALLOCATE_FAIL_PTR;
  }

 done:
  return down_sampler;
}


void DownSampler_destruct(DownSampler* down_sampler)
{
  FilterChain_destruct_inner(&down_sampler->sub_chain);
  cfc_Free(down_sampler);
}


