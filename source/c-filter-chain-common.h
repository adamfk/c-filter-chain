#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif




typedef struct fc_AbstractAllocator_ fc_AbstractAllocator;

/**
 * This is an abstract Allocator class.
 */
struct fc_AbstractAllocator_
{
  /**
   * Allowed to be NULL for implementations that don't allow freeing.
   */
  void(*free)(fc_AbstractAllocator const * const allocator, void* ptr);

  /**
   * Must be defined.
   */
  void*(*allocate)(fc_AbstractAllocator const * const allocator, size_t object_size);
};

#define fc_allocate(allocator, size) allocator->allocate(allocator, size)
#define fc_free(allocator, address) allocator->free(allocator, address)



typedef struct fc_BuilderConfig_
{
  fc_AbstractAllocator const * allocator;
  //TODO error handlers
} fc_BuilderConfig;




#ifdef __cplusplus
}
#endif

