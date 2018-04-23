#include "fc_lib/fc_CountAllocator.h"
#include "fc_lib/fc_macros.h"
#include <string.h>


static void fc_CountAllocator_free(fc_IAllocator const* const allocator, void* address);
static void* fc_CountAllocator_allocate(fc_IAllocator const * const allocator, size_t object_size);


const fc_IAllocatorVtable fc_CountAllocatorVtable = {
  .free = fc_CountAllocator_free,
  .allocate = fc_CountAllocator_allocate,
};


void fc_CountAllocator_ctor(fc_CountAllocator* self, fc_IAllocator const * wrapped_allocator)
{
  fc_ZERO_STRUCT(*self);
  self->base_instance.vtable = &fc_CountAllocatorVtable;
  self->wrapped_allocator = wrapped_allocator;
}


static void fc_CountAllocator_free(fc_IAllocator const* const allocator, void* address)
{
  fc_CountAllocator* self = (fc_CountAllocator*)allocator;
  fc_IAllocator_free(self->wrapped_allocator, address);
}


static void* fc_CountAllocator_allocate(fc_IAllocator const * const allocator, size_t object_size)
{
  void* result;
  fc_CountAllocator* self = (fc_CountAllocator*)allocator;

  self->requested_bytes += object_size;
  result = fc_IAllocator_allocate(self->wrapped_allocator, object_size);

  return result;
}