#include "fc_lib/fc_BuildCtx.h"
#include "fc_lib/fc_allocate.h"

void fc_BuildCtx_update_minimum_working_buffer(fc_BuildCtx* bc, uint32_t required_size) {
  if (required_size > bc->min_working_buffer_size) {
    bc->min_working_buffer_size = required_size;
  }
}


void fc_BuildCtx_update_success_from_ptr(fc_BuildCtx* bc, void const * ptr) {
  if (is_bad_ptr(ptr)) {
    fc_BuildCtx_update_success(bc, false);
  }
}


void fc_BuildCtx_update_success(fc_BuildCtx* bc, bool success) {
  if (!success) {
    bc->one_or_more_failures = true;
  }
}


void fc_BuildCtx_update_failure(fc_BuildCtx* bc, bool failure) {
  fc_BuildCtx_update_success(bc, !failure);
}


bool fc_BuildCtx_has_failure(fc_BuildCtx* bc) {
  return bc->one_or_more_failures;
}


//TODO decide on should all Builder's have a working buffer instead of a pointer to one?
bool fc_BuildCtx_allocate_working_buffer_if_needed(fc_BuildCtx* bc) 
{
  bool success = false;

  //TODO should we just allocate the working_buffer pointer as well? Would make it easier for users. See issue #27.

  if (bc->working_buffer == NULL) {
    success = false;
    return success;
  }

  //fix for issue #28
  if (bc->min_working_buffer_size == 0) {
    success = true;
    return success;
  }


  bc->working_buffer->buffer = fc_IAllocator_allocate(bc->allocator, bc->min_working_buffer_size);

  if (bc->working_buffer->buffer != NULL) {
    bc->working_buffer->size = bc->min_working_buffer_size;
    success = true;
  }

  return success;
}
