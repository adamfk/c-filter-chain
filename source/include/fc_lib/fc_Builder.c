#include "fc_lib/fc_Builder.h"

void fc_Builder_update_minimum_working_buffer(fc_Builder* bc, uint32_t required_size) {
  if (required_size > bc->min_working_buffer_size) {
    bc->min_working_buffer_size = required_size;
  }
}


//TODO decide on should all Builder's have a working buffer instead of a pointer to one?
bool fc_Builder_allocate_working_buffer(fc_Builder* bc) 
{
  bool success = false;

  if (bc->working_buffer == NULL) {
    return success;
  }

  bc->working_buffer->buffer = fc_IAllocator_allocate(bc->allocator, bc->min_working_buffer_size);

  if (bc->working_buffer->buffer != NULL) {
    bc->working_buffer->size = bc->min_working_buffer_size;
    success = true;
  }

  return success;
}
