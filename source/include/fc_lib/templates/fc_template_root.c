/*
!!!!!!!!NOTE!!!!!!!!!

THIS IS A TEMPLATE FILE! It is meant to be INCLUDED by other files that specify the primitive type to use.




TODO document max filters in a BlockChain_new() call to be 127 based off of https://stackoverflow.com/questions/9034787/function-parameters-max-number
  Not sure if this applies to varargs as well.

TODO fail if more than 127

TODO create error call back for alerting

TODO consider a different construction technique based on lists.
  Con: more memory
  Bah... it doesn't get away from nesting problem as shown below.
    BlockChain_add(fc, fc32_IirLowPass_new() );
    BlockChain_add(fc, fc32_SomeFilter_new() );
    BlockChain_add(fc, fc32_DownSampler_new(0, 2,
      fc32_IirLowPass_new( ),
      fc32_IirLowPass_new( ),
      NULL,
    ) );


*/


//don't include template header as already done by the file that includes this file

#include <string.h>
#include <stdlib.h>
#include "fc_lib/fc_allocate.h"
#include "fc_lib/fc_macros.h"


/**
 * Cast away const to reduce compiler warning. We want user code to see it as const
 * but we also need to return it on failure.
 */
#define fc_ALLOCATE_FAIL_PTR ((void*)fc_ALLOCATE_FAIL_PTR)


 //TODO move to common
static void* allocate_or_ret_fail_ptr(fc_BuildCtx* bc, size_t size)
{
  void* obj = fc_allocate(bc->allocator, size);

  if (obj == NULL) {
    obj = fc_ALLOCATE_FAIL_PTR;
  }

  return obj;
}



//TODO move to common?
static uint16_t count_list_size(IBlock** list)
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
static void destruct_block_array(const fc_IAllocator* allocator, IBlock** blocks, size_t block_count)
{
  for (size_t i = 0; i < block_count; i++)
  {
    IBlock* block = blocks[i];
    fc_destruct_and_free(block, allocator);
  }
}

//TODOLOW move to common 
static void fc_destruct_gb_list(const fc_IAllocator* allocator, IBlock** block_list)
{
  uint16_t i = 0;
  IBlock* block = block_list[i];
  while (block != NULL)
  {
    fc_destruct_and_free(block, allocator);
    block = block_list[++i];
  }

}


/**
* Returns true if found sign of a block allocation failure.
* Copies block regardless of block allocation failure detection.
*/
static bool test_and_copy_block(IBlock** store_at, IBlock* block)
{
  bool allocate_fail_found;

  if (block == fc_ALLOCATE_FAIL_PTR) {
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
static bool test_and_copy_blocks(IBlock** store_in, IBlock** list, uint16_t count)
{
  bool allocate_fail_found = false;

  for (size_t i = 0; i < count; i++)
  {
    allocate_fail_found |= test_and_copy_block(&store_in[i], list[i]);
  }

  return allocate_fail_found;
}




static void shift_queue(fc_Type* array, uint16_t array_length, fc_Type input) {
  //consider using a head/tail instead of shifting data
  for (size_t i = array_length - 1; i > 0; i--) {
    array[i] = array[i - 1];  //consider using memove
  }

  array[0] = input;
}


static void swap(fc_Type *xp, fc_Type *yp)
{
  fc_Type temp = *xp;
  *xp = *yp;
  *yp = temp;
}

/**
 * Blocks should use this implementation when they contain no other block that need to be
 * visisted as well.
 */
static void simple_run_visitor(void* self, fc_IVisitor* visitor)
{
  fc_IVisitor_visit(visitor, self);
}


static void destruct_no_fields(void* self, fc_IAllocator const * allocator)
{
  //do nothing
  (void)self;
  (void)allocator;
}



//####################################################################

#include "fc_lib/templates/fc_IBlock.c"
#include "fc_lib/templates/fc_BlockChain.c"
#include "fc_lib/templates/fc_PassThrough.c"
#include "fc_lib/templates/fc_IirLowPass.c"
#include "fc_lib/templates/fc_Delay.c"
#include "fc_lib/templates/fc_Median.c"
#include "fc_lib/templates/fc_IirAsymLowPass.c"
#include "fc_lib/templates/fc_IirAccelAsymLowPass.c"
#include "fc_lib/templates/fc_DownSampler.c"






