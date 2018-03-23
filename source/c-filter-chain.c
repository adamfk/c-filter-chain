
/*
TODO document max filters in a FilterChain_malloc() call to be 127 based off of https://stackoverflow.com/questions/9034787/function-parameters-max-number
  Not sure if this applies to varargs as well.

TODO fail if more than 127

TODO create error call back for alerting

TODO consider a different construction technique based on lists.
  Con: more memory
  Bah... it doesn't get away from nesting problem as shown below.
    FilterChain_add(fc, fcb32_IirLowPass1_new_malloc() );
    FilterChain_add(fc, fcb32_SomeFilter_new_malloc() );
    FilterChain_add(fc, fcb32_DownSampler_new_malloc(0, 2,
      fcb32_IirLowPass1_new_malloc( ),
      fcb32_IirLowPass1_new_malloc( ),
      NULL,
    ) );


*/


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


/**
 * Cast away const to reduce compiler warning. We want user code to see it as const
 * but we also need to return it on failure.
 */
#define CF_ALLOCATE_FAIL_PTR ((void*)CF_ALLOCATE_FAIL_PTR)


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
* Copies block regardless of block allocation failure detection.
*/
static bool test_and_copy_block(GenericBlock** store_at, GenericBlock* block)
{
  bool allocate_fail_found;

  if (block == CF_ALLOCATE_FAIL_PTR) {
    allocate_fail_found = true;
  } else {
    allocate_fail_found = false;
  }

  *store_at = block;

  return allocate_fail_found;
}


/**
 * Returns true if found sign of a block allocation failure.
 * Copies all blocks regardless of block allocation failure detection.
 * REQUIRES THAT first_block is not NULL.
 */
static bool test_and_copy_blocks(GenericBlock** store_in, GenericBlock* first_block, va_list block_list, size_t total_block_count)
{
  bool allocate_fail_found = false;
  GenericBlock* block;
  size_t store_index = 0;

  allocate_fail_found |= test_and_copy_block(&store_in[store_index++], first_block);

  while (store_index < total_block_count)
  {
    block = va_arg(block_list, GenericBlock*);
    allocate_fail_found |= test_and_copy_block(&store_in[store_index++], block);
  }

  return allocate_fail_found;
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
 * You have to va_start() the list before calling this.
 * TODO: fail if first generic block NULL? There is zero point to an empty chain
 * Returns success
 */
bool FilterChain_malloc_inner(FilterChain* filter_chain, void* first_block, va_list block_list)
{
  bool success = false;
  bool child_allocate_fail = false;
  uint16_t total_block_count = 0;      //TODO make a typedef for chain blocks count size
  GenericBlock** block_array = NULL;

  if (first_block != NULL)
  {
    va_list list_for_counting;
    total_block_count += 1;  //+1 for `first_block`

    //copy the list to count var args
    va_copy(list_for_counting, block_list); //NOTE!
    total_block_count += count_null_term_var_arg_ptrs(list_for_counting);
    va_end(list_for_counting); //NOTE!

    //TODO consider using a C99 variable sized array on stack so that we don't have to multiple `va_end(block_list)` calls

    //try to allocate block array
    block_array = cfc_Malloc(total_block_count * sizeof(block_array[0]));
    if (block_array == NULL) {
      va_end(block_list); //NOTE!
      goto done;
    }
    child_allocate_fail = test_and_copy_blocks(block_array, first_block, block_list, total_block_count);
  }
  va_end(block_list); //NOTE!

  filter_chain->blocks = block_array;
  filter_chain->block_count = total_block_count;

  if (child_allocate_fail) {
    goto failure_free_all;
  }

  success = true;
  goto done;

failure_free_all:
  destruct_blocks(block_array, total_block_count);
  cfc_Free(block_array);
done:
  return success;
}



/**
 * varargs MUST BE NULL TERMINATED!
 * Arguments should all be of type GenericBlock* or NULL.
 * 
 * Could do this nicer if used C99 compound literal, but then no cpp support
 * which is very useful for testing and cpp devs.
 * 
 * TODO: consider making a function that tries to determine if a passed in block is bogus
 * to detect someone forgetting to NULL terminate the list.
 * 
 * Returns #CF_ALLOCATE_FAIL_PTR if this or a passed block failed allocation.
 */
FilterChain* FilterChain_malloc(void* first_block, ...)
{
  FilterChain* filter_chain;
  bool success = true;
  va_list list;

  filter_chain = cfc_Malloc(sizeof(*filter_chain));
  if (filter_chain == NULL) {
    success = false;
  }
  else {
    va_start(list, first_block);
    success = FilterChain_malloc_inner(filter_chain, first_block, list);
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
DownSampler* DownSampler_new_malloc(uint16_t sample_offset, uint16_t sample_every_x, void* first_block, ...)
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

  va_start(list, first_block);
  inner_malloc_success = FilterChain_malloc_inner(&down_sampler->sub_chain, first_block, list);
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


