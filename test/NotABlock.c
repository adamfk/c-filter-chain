#include "NotABlock.h"
#include <string.h>

/*
  This class is ONLY used for comparing against via the `_Test_type()` methods.
*/

//prototypes
static void NotABlock_preload(void* self, int32_t input);
static int32_t NotABlock_step(void* self, int32_t input);


static void NotABlock_destruct_fields(NotABlock* self, fc_IAllocator const * allocator)
{
  (void)self;
  (void)allocator;
}

static void NotABlock_run_visitor(NotABlock* block, fc_IVisitor* visitor)
{
  fc_IVisitor_block_entered(visitor, block);
  fc_IVisitor_block_exited(visitor, block);
}


static const NotABlockVirtualTable NotABlock_vtable = {
  .step = NotABlock_step,
  .preload = NotABlock_preload,
  .destruct_fields = NotABlock_destruct_fields,
  .run_visitor = NotABlock_run_visitor,
};


void NotABlock_ctor(NotABlock* self)
{
  fc_ZERO_STRUCT(*self);
  self->vtable = &NotABlock_vtable;
}



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################


static void NotABlock_preload(void* self, int32_t input)
{
  (void)self; (void)input;
}


static int32_t NotABlock_step(void* self, int32_t input)
{
  (void)self; (void)input;
  return 0;
}
