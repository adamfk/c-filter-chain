#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "fc_lib/fc_macros.h"
#include "fc_lib/fc_IAllocator.h"
#include "fc_lib/fc_WorkingBuffer.h"

fc_BEGIN_C_DECLS

//TODO rename to fc_BuildContex

typedef struct fc_Builder_
{
  fc_IAllocator const * allocator;

  //TODO error handlers

  /**
   * Modify via #fc_Builder_update_minimum_working_buffer()
   * Do not manually fiddle with.
   * Set by filters during construction to indicate how much of a working buffer they need.
   */
  uint32_t min_working_buffer_size;

  fc_WorkingBuffer* working_buffer;
} fc_Builder;


void fc_Builder_update_minimum_working_buffer(fc_Builder* bc, uint32_t required_size);
bool fc_Builder_allocate_working_buffer(fc_Builder* self);


fc_END_C_DECLS
