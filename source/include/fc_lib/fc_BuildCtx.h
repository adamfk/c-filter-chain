#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "fc_lib/fc_macros.h"
#include "fc_lib/fc_IAllocator.h"
#include "fc_lib/fc_WorkingBuffer.h"

fc_BEGIN_C_DECLS

//TODO rename to fc_BuildContex

typedef struct fc_BuildCtx_
{
  fc_IAllocator const * allocator;

  //TODO error handlers

  /**
   * Modify via #fc_BuildCtx_update_minimum_working_buffer()
   * Do not manually fiddle with.
   * Set by filters during construction to indicate how much of a working buffer they need.
   */
  uint32_t min_working_buffer_size;

  /**
   * 
   */
  bool one_or_more_failures;

  fc_WorkingBuffer* working_buffer;
} fc_BuildCtx;


void fc_BuildCtx_update_minimum_working_buffer(fc_BuildCtx* bc, uint32_t required_size);
bool fc_BuildCtx_allocate_working_buffer_if_needed(fc_BuildCtx* self);
void fc_BuildCtx_update_success(fc_BuildCtx* bc, bool success);
void fc_BuildCtx_update_failure(fc_BuildCtx* bc, bool failure);
void fc_BuildCtx_update_success_from_ptr(fc_BuildCtx* bc, void const * ptr);
bool fc_BuildCtx_has_failure(fc_BuildCtx* bc);

fc_END_C_DECLS
