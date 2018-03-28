#include "fc_CountAllocator.h"
#include <string.h>

//TODO put in common macros
#define ZERO_STRUCT(my_struct)  memset(&(my_struct), 0, sizeof(my_struct));


static void fc_CountAllocator_free(fc_AbstractAllocator const* const allocator, void* address);
static void* fc_CountAllocator_allocate(fc_AbstractAllocator const * const allocator, size_t object_size);


const fc_AbstractAllocatorVtable fc_CountAllocatorVtable = {
  .free = fc_CountAllocator_free,
  .allocate = fc_CountAllocator_allocate,
};


void fc_CountAllocator_ctor(fc_CountAllocator* self, fc_AbstractAllocator const * wrapped_allocator)
{
  ZERO_STRUCT(*self);
  self->base_instance.vtable = &fc_CountAllocatorVtable;
  self->wrapped_allocator = wrapped_allocator;
}


static void fc_CountAllocator_free(fc_AbstractAllocator const* const allocator, void* address)
{
  fc_CountAllocator* self = (fc_CountAllocator*)allocator;
  self->wrapped_allocator->vtable->free(allocator, address);
}


static void* fc_CountAllocator_allocate(fc_AbstractAllocator const * const allocator, size_t object_size)
{
  void* result;
  fc_CountAllocator* self = (fc_CountAllocator*)allocator;

  self->requested_bytes += object_size;
  result = self->wrapped_allocator->vtable->allocate(allocator, object_size);

  return result;
}