#include <stdlib.h>
#include "fc_Mallocator.h"
#include "user-stuff.h"

#ifndef fc_MALLOC_FUNC 
#  define fc_MALLOC_FUNC malloc 
#  ifndef fc_FREE_FUNC 
#    define fc_FREE_FUNC free 
#  endif 
#endif 

static void fc_Mallocator_free(fc_AbstractAllocator const* const allocator, void* address);
static void* fc_Mallocator_allocate(fc_AbstractAllocator const * const allocator, size_t object_size);

const fc_AbstractAllocator fc_Mallocator = {
  .free = fc_Mallocator_free,
  .allocate = fc_Mallocator_allocate,
};

static void fc_Mallocator_free(fc_AbstractAllocator const* const allocator, void* address)
{
  (void)allocator;
  if (address) {
    fc_FREE_FUNC(address);
  }
}

static void* fc_Mallocator_allocate(fc_AbstractAllocator const * const allocator, size_t object_size)
{
  (void)allocator;
  void* address = fc_MALLOC_FUNC(object_size);
  return address;
}



