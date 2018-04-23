

#define Median_vtable FC_MAKE_NAME(Median_vtable)

const IBlockVirtualTable Median_vtable = {
  .step = Median_step,
  .preload = Median_preload,
  .destruct_fields = Median_destruct_fields,
  .run_visitor = simple_run_visitor,
};


void Median_ctor(Median* self)
{
  fc_ZERO_STRUCT(*self);
  self->block.vtable = &Median_vtable;
}


static size_t Median_calc_buffer_size(uint16_t filter_length)
{
  size_t size = sizeof(fc_Type)*(filter_length);
  return size;
}


IBlock* Median_new_iblock(fc_Builder* bc, uint16_t length)
{
  return (IBlock*) Median_new(bc, length);
}


/**
* Returns #fc_ALLOCATE_FAIL_PTR on allocate failure.
*/
Median* Median_new(fc_Builder* bc, uint16_t length)
{
  uint16_t saved_sample_length = length - 1;  //-1 because we save one less than length of median filter as it has access to the input
  bool success = true;
  fc_Type* array;

  Median* self = allocate_or_ret_fail_ptr(bc, sizeof(Median));
  if (is_bad_ptr(self)) {
    success = false;
  }

  //try to allocate always to allow determining required size for full chain
  array = allocate_or_ret_fail_ptr(bc, sizeof(fc_Type)*saved_sample_length);

  if (is_bad_ptr(array)) {
    success = false;
  }

  if (success) {
    Median_ctor(self);
    self->working_buffer = bc->working_buffer;
    self->saved_sample_length = saved_sample_length;
    self->previous_samples = array;
    fc_Builder_update_minimum_working_buffer(bc, Median_calc_buffer_size(length));
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


void Median_destruct_fields(Median* self, fc_IAllocator const * allocator)
{
  fc_free(allocator, self->previous_samples);
}


void Median_preload(Median* self, fc_Type input)
{
  for (size_t i = 0; i < self->saved_sample_length; i++) {
    self->previous_samples[i] = input;
  }
}





fc_Type Median_step(Median* self, fc_Type input)
{
  fc_Type output;
  fc_Type* sorted_samples = self->working_buffer->buffer;
  uint16_t filter_length = self->saved_sample_length + 1;
  size_t buffer_size = Median_calc_buffer_size(filter_length);

  if (self->saved_sample_length == 0) {
    return input;
  }

  if (self->working_buffer->size < buffer_size) {
    return 0; //TODO make a way to get errors out of filter
  }

  memcpy(sorted_samples, self->previous_samples, sizeof(self->previous_samples[0]) * self->saved_sample_length);
  sorted_samples[self->saved_sample_length] = input;

  //sort samples using a slow, but light on stack space, buble sort
  int i, j;
  for (i = 0; i < filter_length - 1; i++) {
    for (j = 0; j < filter_length - i - 1; j++) {
      if (sorted_samples[j] > sorted_samples[j + 1]) {
        swap(&sorted_samples[j], &sorted_samples[j + 1]);
      }
    }
  }

  output = sorted_samples[filter_length / 2]; //could average middle if even number

  shift_queue(self->previous_samples, self->saved_sample_length, input);

  return output;
}


/**
 * Class method.
 * Use to check if an IBlock is a Median block.
 */
bool Median_Test_type(void* some_block)
{
  IBlock* block = (IBlock*)some_block;
  bool result = block->vtable->step == Median_vtable.step;
  return result;
}
