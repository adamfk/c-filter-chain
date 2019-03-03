#include "fc_lib/fc_allocate.h"

/**
 * See .h file
 */
void const * const fc_ALLOCATE_FAIL_PTR = &(int) {2};



void* fc_allocate(fc_IAllocator const * const allocator, size_t size)
{
  void * result;

  if (!allocator) {
    return (void*)fc_ALLOCATE_FAIL_PTR; //cast away const
  }
  
  result = fc_IAllocator_allocate(allocator, size);
  return result;
}


void fc_free(fc_IAllocator const * const allocator, void* address) {
  if (!allocator) {
    return;
  }

  if (is_ok_ptr(address)) {
    fc_IAllocator_free(allocator, address);
  }
}




//TODO namespace
bool is_bad_ptr(const void* ptr)
{
  bool is_bad = (ptr == NULL) || (ptr == fc_ALLOCATE_FAIL_PTR);
  return is_bad;
}


//TODO namespace
bool is_ok_ptr(const void* ptr)
{
  bool is_ok = !is_bad_ptr(ptr);
  return is_ok;
}