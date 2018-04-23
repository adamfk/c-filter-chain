#include "fc_IAllocator.h"

/*
  This is an interface and should only wrap access to the `vtable`.
*/

void fc_IAllocator_free(fc_IAllocator const * const allocator, void* ptr) {
  allocator->vtable->free(allocator, ptr);
}


void* fc_IAllocator_allocate(fc_IAllocator const * const allocator, size_t object_size) {
  return allocator->vtable->allocate(allocator, object_size);
}
