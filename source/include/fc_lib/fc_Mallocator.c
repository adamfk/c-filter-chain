#include <stdlib.h>
#include "fc_Mallocator.h"
#include "fc_default_config.h"


static void fc_Mallocator_free(fc_IAllocator const* const allocator, void* address);
static void* fc_Mallocator_allocate(fc_IAllocator const * const allocator, size_t object_size);


const fc_IAllocatorVtable fc_MallocatorVtable = {
  .free = fc_Mallocator_free,
  .allocate = fc_Mallocator_allocate,
};


const fc_IAllocator fc_Mallocator = {
  .vtable = &fc_MallocatorVtable,
};


static void fc_Mallocator_free(fc_IAllocator const* const allocator, void* address)
{
  (void)allocator;
  if (address) { //TODO check if address isn't the "bad" pointer before trying to free
    fc_FREE_FUNC(address);
  }
}


static void* fc_Mallocator_allocate(fc_IAllocator const * const allocator, size_t object_size)
{
  (void)allocator;
  void* address = fc_MALLOC_FUNC(object_size);
  return address;
}



