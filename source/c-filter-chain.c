
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


static uint16_t count_list_size(void** list)
{
  uint16_t count = 0;
  void* ptr = list[count];
  while (ptr != NULL)
  {
    ptr = list[++count];
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
static bool test_and_copy_blocks(GenericBlock** store_in, void** list, uint16_t count)
{
  bool allocate_fail_found = false;

  for (size_t i = 0; i < count; i++)
  {
    allocate_fail_found |= test_and_copy_block(&store_in[i], list[i]);
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
 * blocks array MUST BE NULL TERMINATED!
 * TODO: fail if an empty chain?
 * Returns success
 */
bool FilterChain_malloc_inner(FilterChain* filter_chain, GenericBlock** block_list)
{
  bool success = false;
  bool child_allocate_fail = false;
  uint16_t total_block_count = 0;      //TODO make a typedef for chain blocks count size
  GenericBlock** block_array = NULL;

  total_block_count = count_list_size(block_list);

  //try to allocate block array
  block_array = cfc_Malloc(total_block_count * sizeof(block_array[0]));

  if (block_array != NULL) 
  {
    child_allocate_fail = test_and_copy_blocks(block_array, block_list, total_block_count);

    if (child_allocate_fail) {
      destruct_blocks(block_array, total_block_count);
      cfc_Free(block_array);
    } 
    else {
      filter_chain->blocks = block_array;
      filter_chain->block_count = total_block_count;
      success = true;
    }
  }

  return success;
}



/**
 * block_list MUST BE NULL TERMINATED!
 * Arguments should all be of type GenericBlock* or NULL.
 * 
 * TODO: consider making a function that tries to determine if a passed in block is bogus
 * to detect someone forgetting to NULL terminate the list.
 * 
 * Returns #CF_ALLOCATE_FAIL_PTR if this or a passed block failed allocation.
 */
FilterChain* FilterChain_malloc(GenericBlock** block_list)
{
  FilterChain* filter_chain;
  bool success = true;

  filter_chain = cfc_Malloc(sizeof(*filter_chain));
  if (filter_chain == NULL) {
    success = false;
  }
  else {
    success = FilterChain_malloc_inner(filter_chain, block_list);

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
    output = block->function_table->filter(block, input);
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


void PassThrough_ctor(PassThrough* passThrough)
{
  ZERO_STRUCT(*passThrough);
  passThrough->block.function_table = &PassThrough_ftable;
}


/**
 * Returns #CF_ALLOCATE_FAIL_PTR on allocate failure.
 */
PassThrough* PassThrough_new_malloc()
{
  PassThrough* p = malloc_then_func_or_ret_fail_ptr(sizeof(PassThrough), PassThrough_ctor);
  return p;
}


void PassThrough_destruct(PassThrough* block)
{
  cfc_Free(block);
}


void PassThrough_setup(PassThrough* passThrough)
{
}


fc_Type PassThrough_filter(PassThrough* passThrough, fc_Type input)
{
  return input;
}



//####################################################################



#define IirLowPass1_ftable FC_MAKE_NAME(fc_IirLowPass1_ftable)

const BlockFunctionTable IirLowPass1_ftable = {
  .filter = (GenericBlock_filter_t)IirLowPass1_filter,
  .setup = (GenericBlock_setup_t)IirLowPass1_setup,
  .destruct = (GenericBlock_destruct_t)IirLowPass1_destruct,
};


void IirLowPass1_ctor(IirLowPass1* iir)
{
  ZERO_STRUCT(*iir);
  iir->block.function_table = &IirLowPass1_ftable;
}

IirLowPass1* IirLowPass1_new_malloc(float new_ratio)
{
  IirLowPass1* p = malloc_then_func_or_ret_fail_ptr(sizeof(IirLowPass1), IirLowPass1_ctor);
  
  if (p != CF_ALLOCATE_FAIL_PTR) {
    p->new_ratio = new_ratio;
  }

  return p;
}

GenericBlock* IirLowPass1_new_malloc_gb(float new_ratio)
{
  IirLowPass1* result = IirLowPass1_new_malloc(new_ratio);
  return &result->block;
}

void IirLowPass1_destruct(IirLowPass1* p)
{
  cfc_Free(p);
}

void IirLowPass1_setup(IirLowPass1* iir)
{
  iir->last_output = 0;
}


/**
 * Note that if this is an integer based IIR, the rounding errors can be substantial if the input
 * is small. Test with a step function and see if it reaches 100%.
 */
fc_Type IirLowPass1_filter(IirLowPass1* iir, fc_Type input)
{
  fc_Type result;
  double output = iir->new_ratio * input + (1 - iir->new_ratio) * iir->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = (fc_Type)(output + 0.5); //TODO make rounding type generic
  iir->last_output = result;
  return result;
}


//###################################################################33


#define DownSampler_ftable FC_MAKE_NAME(DownSampler_ftable)

const BlockFunctionTable DownSampler_ftable = {
  .filter = (GenericBlock_filter_t)DownSampler_filter,
  .setup = (GenericBlock_setup_t)DownSampler_setup,
  .destruct = (GenericBlock_destruct_t)DownSampler_destruct,
};


void DownSampler_ctor(DownSampler* down_sampler)
{
  ZERO_STRUCT(*down_sampler);
  down_sampler->block.function_table = &DownSampler_ftable;
}


void DownSampler_setup(DownSampler* down_sampler)
{
  down_sampler->latched_output = 0;
  FilterChain_setup(&down_sampler->sub_chain);
}


fc_Type DownSampler_filter(DownSampler* down_sampler, fc_Type input)
{
  down_sampler->sample_count++;

  if (down_sampler->sample_count >= down_sampler->sample_every_x)
  {
    down_sampler->latched_output = FilterChain_filter(&down_sampler->sub_chain, input);
    down_sampler->sample_count = 0;
  }

  return down_sampler->latched_output;
}

/**
 * varargs MUST BE NULL TERMINATED!
 * SEE #FilterChain_new_malloc for usage.
 */
DownSampler* DownSampler_new_malloc(uint16_t sample_offset, uint16_t sample_every_x, GenericBlock** block_list)
{
  bool inner_malloc_success;
  DownSampler* down_sampler;

  down_sampler = malloc_then_func_or_ret_fail_ptr(sizeof(DownSampler), DownSampler_ctor);
  if (down_sampler == CF_ALLOCATE_FAIL_PTR) {
    goto done;
  }

  down_sampler->sample_every_x = sample_every_x;
  down_sampler->sample_count = sample_offset;

  inner_malloc_success = FilterChain_malloc_inner(&down_sampler->sub_chain, block_list);

  if (!inner_malloc_success) {
    cfc_Free(down_sampler);
    down_sampler = CF_ALLOCATE_FAIL_PTR;
  }

 done:
  return down_sampler;
}

GenericBlock* DownSampler_new_malloc_gb(uint16_t sample_offset, uint16_t sample_every_x, GenericBlock** block_list)
{
  return (GenericBlock*)DownSampler_new_malloc(sample_offset, sample_every_x, block_list);
}


void DownSampler_destruct(DownSampler* down_sampler)
{
  FilterChain_destruct_inner(&down_sampler->sub_chain);
  cfc_Free(down_sampler);
}


