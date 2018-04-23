#include "fc_lib/fc_common.h"
#include "fc_lib/fc_allocate.h"

//get a structure for any IBlock type to allow casting
#define FILTER_CHAIN_NAME_PREFIX 8
#define FILTER_CHAIN_TYPE int8_t
#include "fc_lib/templates/fc_template_root.h"


/**
 * @param iblock should be of type IBlock.
 * Exists because some blocks do not define `destruct_fields`
 */
void fc_destruct_and_free(void* iblock, const fc_IAllocator* allocator)
{
  fc8_IBlock* block = iblock; //cast to any IBlock type

  if (is_ok_ptr(block))
  {
    IBlock_destruct_fields(block, allocator);

    //TODO: finalize when allocator allowed to be NULL
    if (allocator) {
      fc_free(allocator, block);
    }
  }
}


/**
 * @param iblock should be of type IBlock.
 */
void fc_run_visitor(fc_IVisitor* visitor, void* iblock)
{
  fc8_IBlock* block = iblock; //cast to any IBlock type
  IBlock_run_visitor(block, visitor);
}


