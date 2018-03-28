#include "c-filter-chain-common.h"

/**
 * This is a special pointer value to indicate an allocation failure.
 * The lib uses NULL to terminate lists and needs this special pointer
 * value to be able to detect a nested allocation failure.
 */
void const * const CF_ALLOCATE_FAIL_PTR = &(int) {2};


void* fc_allocate(fc_AbstractAllocator const * const allocator, size_t size)
{
  void * result;

  if (!allocator) {
    return (void*)CF_ALLOCATE_FAIL_PTR;
  }

  result = allocator->vtable->allocate(allocator, size);
  return result;
}

void fc_free(fc_AbstractAllocator const * const allocator, void* address) {
  if (!allocator) {
    return;
  }
  allocator->vtable->free(allocator, address);
}
