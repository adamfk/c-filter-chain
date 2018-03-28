#pragma once
#include "c-filter-chain-common.h"
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif




/**
 * Extends fc_AbstractAllocator.
 * Simply wraps another allocator and counts the number of total bytes that were requested.
 */
typedef struct fc_CountAllocator_
{
  fc_AbstractAllocator base_instance;   //MUST BE FIRST IN STRUCT for polymorphism
  fc_AbstractAllocator const * wrapped_allocator;
  size_t requested_bytes;
} fc_CountAllocator;


void fc_CountAllocator_ctor(fc_CountAllocator* self, fc_AbstractAllocator const * wrapped_allocator);



#ifdef __cplusplus
}
#endif
