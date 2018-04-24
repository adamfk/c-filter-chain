

#define IirAsymLowPass_vtable FC_MAKE_NAME(fc_IirAsymLowPass_vtable)

const IBlockVirtualTable IirAsymLowPass_vtable = {
  .step = IirAsymLowPass_step,
  .preload = IirAsymLowPass_preload,
  .destruct_fields = destruct_no_fields,
  .run_visitor = simple_run_visitor,
};


void IirAsymLowPass_ctor(IirAsymLowPass* iir)
{
  fc_ZERO_STRUCT(*iir);
  iir->block.vtable = &IirAsymLowPass_vtable;
}

IirAsymLowPass* IirAsymLowPass_new(fc_BuildCtx* bc, float higher_ratio, float lower_ratio)
{
  IirAsymLowPass* self = allocate_or_ret_fail_ptr(bc, sizeof(IirAsymLowPass));

  if (is_ok_ptr(self)) {
    IirAsymLowPass_ctor(self);
    self->higher_ratio = higher_ratio;
    self->lower_ratio = lower_ratio;
  }

  fc_BuildCtx_update_success_from_ptr(bc, self);

  return self;
}

IBlock* IirAsymLowPass_new_iblock(fc_BuildCtx* bc, float higher_ratio, float lower_ratio)
{
  IirAsymLowPass* result = IirAsymLowPass_new(bc, higher_ratio, lower_ratio);
  return (IBlock*)result;
}


/**
 * Class method.
 * Use to check if an IBlock is a IirAsymLowPass block.
 */
bool IirAsymLowPass_Test_type(void* some_block)
{
  IBlock* block = (IBlock*)some_block;
  bool result = block->vtable->step == IirAsymLowPass_vtable.step;
  return result;
}


//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAsymLowPass_preload(void* vself, fc_Type input)
{
  IirAsymLowPass* self = (IirAsymLowPass*)vself;
  self->last_output = input;
}


/**
* Note that if this is an integer based IIR, the rounding errors can be substantial if the input
* is small. Test with a step function and see if it reaches 100%.
*/
fc_Type IirAsymLowPass_step(void* vself, fc_Type input)
{
  IirAsymLowPass* self = (IirAsymLowPass*)vself;
  fc_Type result;
  float new_ratio;

  if (input > self->last_output) {
    new_ratio = self->higher_ratio;
  }
  else {
    new_ratio = self->lower_ratio;
  }

  double output = new_ratio * input + (1 - new_ratio) * self->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = (fc_Type)(output + 0.5); //TODO make rounding type generic. and respects negative numbers.
  self->last_output = result;
  return result;
}

