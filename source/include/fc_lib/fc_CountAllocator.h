#pragma once
#include "fc_lib/fc_common.h"
#include "fc_lib/fc_macros.h"
#include <stdint.h>

fc_BEGIN_C_DECLS


/**
 * Extends fc_IAllocator.
 * Simply wraps another allocator and counts the number of total bytes that were requested.
 */
typedef struct fc_CountAllocator_
{
  fc_IAllocator base_instance;   //MUST BE FIRST IN STRUCT for polymorphism
  fc_IAllocator const * wrapped_allocator;
  size_t requested_bytes;

  /*
    TODO! 
    how to determine the space required accurately?
    we can easily track the number of bytes requested, allocated, failed allocation...
    but we don't know the efficiency of the actual allocator. It may pad everything to a block of size X.
    It may allocate extra tracking header information in each request.

    Maybe the best thing to do is just write our own simple non-freeing allocator that can report
    back the real size it needs and then let the user allocate that.

    Simple implementation would keep a pointer to next u8, u16, u32+
    
  */

} fc_CountAllocator;


void fc_CountAllocator_ctor(fc_CountAllocator* self, fc_IAllocator const * wrapped_allocator);


fc_END_C_DECLS
