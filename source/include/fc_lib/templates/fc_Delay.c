
#define Delay_vtable FC_MAKE_NAME(Delay_vtable)

//TODO make static?
const IBlockVirtualTable Delay_vtable = {
  .step = Delay_step,
  .preload = Delay_preload,
  .destruct_fields = Delay_destruct_fields,
  .run_visitor = simple_run_visitor,
};


void Delay_ctor(Delay* self)
{
  fc_ZERO_STRUCT(*self);
  self->block.vtable = &Delay_vtable;
}


/**
* Returns #fc_ALLOCATE_FAIL_PTR on allocate failure.
*/
Delay* Delay_new(fc_Builder* bc, uint16_t history_depth)
{
  bool success = true;
  fc_Type* array;

  Delay* self = allocate_or_ret_fail_ptr(bc, sizeof(Delay));
  if (is_bad_ptr(self)) {
    success = false;
  }

  //try to allocate always to allow determining required size for full chain
  array = allocate_or_ret_fail_ptr(bc, sizeof(fc_Type)*history_depth);

  if (is_bad_ptr(self)) {
    success = false;
  }

  if (success) {
    Delay_ctor(self);
    self->saved_sample_length = history_depth;
    self->previous_samples = array;
  }
  else {
    //some part failed
    if (is_ok_ptr(self)) {
      fc_free(bc->allocator, self);
    }
    if (is_ok_ptr(array)) {
      fc_free(bc->allocator, array);
    }
  }

  return self;
}


/**
 * Class method.
 * Use to check if an IBlock is a Delay block.
 */
bool Delay_Test_type(IBlock* some_block)
{
  bool result = some_block->vtable->step == Delay_vtable.step;
  return result;
}


//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void Delay_preload(void* vself, fc_Type input)
{
  Delay* self = (Delay*)vself;

  for (size_t i = 0; i < self->saved_sample_length; i++) {
    self->previous_samples[i] = input;
  }
}


fc_Type Delay_step(void* vself, fc_Type input)
{
  Delay* self = (Delay*)vself;
  fc_Type output = self->previous_samples[self->saved_sample_length - 1];

  shift_queue(self->previous_samples, self->saved_sample_length, input);
  return output;
}


void Delay_destruct_fields(void* vself, fc_IAllocator const * allocator)
{
  Delay* self = (Delay*)vself;
  fc_free(allocator, self->previous_samples);
}