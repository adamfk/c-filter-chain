#pragma once
#include <stdlib.h>
#include "fc_lib/fc_macros.h"


fc_BEGIN_C_DECLS



//forward declare
typedef struct fc_IAllocator_ fc_IAllocator;

typedef struct fc_IAllocatorVtable_
{
  /**
   * Allowed to be NULL for implementations that don't allow freeing.
   */
  void(*free)(fc_IAllocator const * const allocator, void* ptr);

  /**
   * Must be defined.
   */
  void*(*allocate)(fc_IAllocator const * const allocator, size_t object_size);
} fc_IAllocatorVtable;


/**
 * This is an Allocator interface.
 */
struct fc_IAllocator_
{
  /**
   * Prefer not directly accessing `vtable` to allow future refactors.
   * Use thin wrapper functions like `fc_IAllocator_free( )` instead. 
   * They should be inlined by the compiler/linker anyway.
   */
  fc_IAllocatorVtable const * vtable;
};


void fc_IAllocator_free(fc_IAllocator const * const allocator, void* ptr);
void* fc_IAllocator_allocate(fc_IAllocator const * const allocator, size_t object_size);

fc_END_C_DECLS

