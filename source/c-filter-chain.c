
/*
TODO document max filters in a FilterChain_new() call to be 127 based off of https://stackoverflow.com/questions/9034787/function-parameters-max-number
  Not sure if this applies to varargs as well.

TODO fail if more than 127

TODO create error call back for alerting

TODO consider a different construction technique based on lists.
  Con: more memory
  Bah... it doesn't get away from nesting problem as shown below.
    FilterChain_add(fc, fcb32_IirLowPass1_new() );
    FilterChain_add(fc, fcb32_SomeFilter_new() );
    FilterChain_add(fc, fcb32_DownSampler_new(0, 2,
      fcb32_IirLowPass1_new( ),
      fcb32_IirLowPass1_new( ),
      NULL,
    ) );


*/


//don't include header if already done by the file that includes this file
#ifndef C_FILTER_CHAIN_C_SKIP_HEADER_INCLUDE
#include "c-filter-chain.h"
#endif

#include <string.h>
#include <stdlib.h>


#define ZERO_STRUCT(my_struct)  memset(&(my_struct), 0, sizeof(my_struct));


/**
 * Cast away const to reduce compiler warning. We want user code to see it as const
 * but we also need to return it on failure.
 */
#define CF_ALLOCATE_FAIL_PTR ((void*)CF_ALLOCATE_FAIL_PTR)


 


static void* allocate_or_ret_fail_ptr(fc_BuilderConfig* bc, size_t size)
{
  void* gb = fc_allocate(bc->allocator, size);

  if (gb == NULL) {
    gb = CF_ALLOCATE_FAIL_PTR;
  }

  return gb;
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


//TODOLOW move to common 
void fc_destruct_and_free_block(const fc_AbstractAllocator* allocator, GenericBlock* block)
{
  if (block != NULL && block != CF_ALLOCATE_FAIL_PTR)
  {
    if (block->function_table->destruct_fields) {
      block->function_table->destruct_fields(allocator, block);
    }

    if (allocator) {
      fc_free(allocator, block);
    }
  }

}

//TODOLOW move to common
static void destruct_block_array(const fc_AbstractAllocator* allocator, GenericBlock** blocks, size_t block_count)
{
  for (size_t i = 0; i < block_count; i++)
  {
    GenericBlock* block = blocks[i];
    fc_destruct_and_free_block(allocator, block);
  }
}

//TODOLOW move to common 
static void fc_destruct_gb_list(const fc_AbstractAllocator* allocator, GenericBlock** block_list)
{
  uint16_t i = 0;
  GenericBlock* block = block_list[i];
  while (block != NULL)
  {
    fc_destruct_and_free_block(allocator, block);
    block = block_list[++i];
  }

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






//####################################################################



#define FilterChain_ftable FC_MAKE_NAME(FilterChain_ftable)

const BlockFunctionTable FilterChain_ftable = {
  .filter = (GenericBlock_filter_t)FilterChain_filter,
  .setup = (GenericBlock_setup_t)FilterChain_setup,
  .destruct_fields = (GenericBlock_destruct_fields_t)FilterChain_destruct_fields,
};


void FilterChain_ctor(FilterChain* fc)
{
  ZERO_STRUCT(*fc);
  fc->block.function_table = &FilterChain_ftable;
}



/**
 * blocks list MUST BE NULL TERMINATED!
 * TODO: fail if an empty chain?
 * Returns success
 */
bool FilterChain_allocate_fields(fc_BuilderConfig* bc, FilterChain* self, GenericBlock** block_list)
{
  bool success = false;
  bool child_allocate_fail = false;
  uint16_t total_block_count = 0;      //TODO make a typedef for chain blocks count size
  GenericBlock** block_array = NULL;

  const fc_AbstractAllocator* allocator = bc->allocator;

  self->builder_config = bc;

  total_block_count = count_list_size(block_list);

  //try to allocate block array
  block_array = fc_allocate(allocator, total_block_count * sizeof(block_array[0]));

  if (!block_array) {
    goto destroy_block_list;
  }

  child_allocate_fail = test_and_copy_blocks(block_array, block_list, total_block_count);

  if (child_allocate_fail) {
    fc_free(allocator, block_array);
    goto destroy_block_list;
  }

  self->blocks = block_array;
  self->block_count = total_block_count;
  success = true;
  goto done;


destroy_block_list:
  fc_destruct_gb_list(allocator, block_list);

done:
  return success;
}



/**
 * block_list MUST BE NULL TERMINATED!
 * Arguments should all be of type GenericBlock* or NULL.
 * 
 * TODO: consider making a function that tries to determine if a passed in block is bogus
 * to detect someone forgetting to NULL terminate the list.
 * 
 * TODOLOW: this could be moved to common file
 * 
 * Returns #CF_ALLOCATE_FAIL_PTR if this or a passed block failed allocation.
 */
FilterChain* FilterChain_new(fc_BuilderConfig* bc, GenericBlock** block_list)
{
  FilterChain* self;
  bool success = true;

  self = allocate_or_ret_fail_ptr(bc, sizeof(*self));

  if (self == CF_ALLOCATE_FAIL_PTR) {
    success = false;
    //can't let `FilterChain_allocate_fields` destruct list as we don't even have a FilterChain object
    fc_destruct_gb_list(bc->allocator, block_list);
  }
  else {
    FilterChain_ctor(self);
    success = FilterChain_allocate_fields(bc, self, block_list);

    if (!success) {
      fc_free(bc->allocator, self);
    }
  }

  if (!success) {
    self = CF_ALLOCATE_FAIL_PTR;
  }

  return self;
}



void FilterChain_destruct_fields(fc_AbstractAllocator const * allocator, FilterChain* fc)
{
  allocator = NULL; //ignore passed in allocator as we have our own

  if (fc->builder_config) {
    allocator = fc->builder_config->allocator;
  }

  destruct_block_array(allocator, fc->blocks, fc->block_count);
  fc_free(allocator, fc->blocks);
}


void FilterChain_destruct_entire(FilterChain* fc)
{
  fc_destruct_and_free_block(fc->builder_config->allocator, &fc->block);
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
  //.destruct_fields = (GenericBlock_destruct_t)PassThrough_destruct, //uses default destructor
};


void PassThrough_ctor(PassThrough* passThrough)
{
  ZERO_STRUCT(*passThrough);
  passThrough->block.function_table = &PassThrough_ftable;
}


/**
 * Returns #CF_ALLOCATE_FAIL_PTR on allocate failure.
 */
PassThrough* PassThrough_new(fc_BuilderConfig* bc)
{
  PassThrough* p = allocate_or_ret_fail_ptr(bc, sizeof(PassThrough));
  if (p != CF_ALLOCATE_FAIL_PTR) {
    PassThrough_ctor(p);
  }
  return p;
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
  //.destruct_fields = (GenericBlock_destruct_t)IirLowPass1_destruct, //uses default
};


void IirLowPass1_ctor(IirLowPass1* iir)
{
  ZERO_STRUCT(*iir);
  iir->block.function_table = &IirLowPass1_ftable;
}

IirLowPass1* IirLowPass1_new(fc_BuilderConfig* bc, float new_ratio)
{
  IirLowPass1* p = allocate_or_ret_fail_ptr(bc, sizeof(IirLowPass1));

  if (p != CF_ALLOCATE_FAIL_PTR) {
    IirLowPass1_ctor(p);
    p->new_ratio = new_ratio;
  }

  return p;
}

GenericBlock* IirLowPass1_new_gb(fc_BuilderConfig* bc, float new_ratio)
{
  IirLowPass1* result = IirLowPass1_new(bc, new_ratio);
  return (GenericBlock*)result;
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
  .destruct_fields = (GenericBlock_destruct_fields_t)FilterChain_destruct_fields,  //use FilterChain destructor
};



void DownSampler_ctor(DownSampler* down_sampler)
{
  ZERO_STRUCT(*down_sampler);
  FilterChain_ctor(&down_sampler->base_fc_instance); //construct super class
  down_sampler->base_fc_instance.block.function_table = &DownSampler_ftable;
}


void DownSampler_setup(DownSampler* down_sampler)
{
  down_sampler->latched_output = 0;
  FilterChain_setup(&down_sampler->base_fc_instance);
}


fc_Type DownSampler_filter(DownSampler* down_sampler, fc_Type input)
{
  down_sampler->sample_count++;

  if (down_sampler->sample_count >= down_sampler->sample_every_x)
  {
    down_sampler->latched_output = FilterChain_filter(&down_sampler->base_fc_instance, input);
    down_sampler->sample_count = 0;
  }

  return down_sampler->latched_output;
}

/**
 * block_list MUST BE NULL TERMINATED!
 * SEE #FilterChain_new for usage.
 */
DownSampler* DownSampler_new(fc_BuilderConfig* bc, uint16_t sample_offset, uint16_t sample_every_x, GenericBlock** block_list)
{
  DownSampler* self;

  self = allocate_or_ret_fail_ptr(bc, sizeof(DownSampler));

  if (self == CF_ALLOCATE_FAIL_PTR) {
    fc_destruct_gb_list(bc->allocator, block_list);
    goto done;
  } 

  DownSampler_ctor(self);

  self->sample_every_x = sample_every_x;
  self->sample_count = sample_offset;

  bool inner_malloc_success = FilterChain_allocate_fields(bc, &self->base_fc_instance, block_list);

  if (!inner_malloc_success) {
    fc_free(bc->allocator, self);
    self = CF_ALLOCATE_FAIL_PTR;
  }

 done:
  return self;
}

GenericBlock* DownSampler_new_gb(fc_BuilderConfig* bc, uint16_t sample_offset, uint16_t sample_every_x, GenericBlock** block_list)
{
  return (GenericBlock*)DownSampler_new(bc, sample_offset, sample_every_x, block_list);
}




