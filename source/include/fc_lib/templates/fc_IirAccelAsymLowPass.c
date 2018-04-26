
#define IirAccelAsymLowPass_vtable FC_MAKE_NAME(fc_IirAccelAsymLowPass_vtable)

const IBlockVirtualTable IirAccelAsymLowPass_vtable = {
  .step = IirAccelAsymLowPass_step,
  .preload = IirAccelAsymLowPass_preload,
  .destruct_fields = destruct_no_fields,
  .run_visitor = simple_run_visitor,
};


void IirAccelAsymLowPass_ctor(IirAccelAsymLowPass* iir)
{
  fc_ZERO_STRUCT(*iir);
  iir->block.vtable = &IirAccelAsymLowPass_vtable;
}


IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio)
{
  IirAccelAsymLowPass* self = allocate_or_ret_fail_ptr(bc, sizeof(IirAccelAsymLowPass));

  if (is_ok_ptr(self)) {
    IirAccelAsymLowPass_ctor(self);
    self->raising_ratio = raising_ratio;
    self->lowering_ratio = lowering_ratio;
    self->cur_raising_ratio = self->raising_ratio;
    self->cur_lowering_ratio = self->lowering_ratio;
  }

  fc_BuildCtx_update_success_from_ptr(bc, self);

  return self;
}


IBlock* IirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio)
{
  IirAccelAsymLowPass* result = IirAccelAsymLowPass_new(bc, raising_ratio, lowering_ratio);
  return (IBlock*)result;
}




static void adjust_coefficients(bool reset, float* cur_ratio, float normal_ratio, float ratio_limit)
{
  //TODO consider having the reset be affected by magnitude instead of just binary. To help with tracking 
  // a negative slope signal with tiny positive blips causes undesirable behaviour.
  // See https://github.com/adamfk/c-filter-chain/issues/20 

  if (reset) {
    *cur_ratio *= 0.3f;
    ENSURE_NOT_LOWER_THAN(*cur_ratio, normal_ratio);
  } else {
    *cur_ratio *= 1.1f; //1.05 good for slowish
    ENSURE_NOT_HIGHER_THAN(*cur_ratio, ratio_limit);
  }
  
}




/**
 * Class method.
 * Use to check if an IBlock is a IirAccelAsymLowPass block.
 */
bool IirAccelAsymLowPass_Test_type(IBlock* some_block)
{
  bool result = some_block->vtable->step == IirAccelAsymLowPass_vtable.step;
  return result;
}





//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAccelAsymLowPass_preload(void* vself, fc_PTYPE input)
{
  IirAccelAsymLowPass* self = (IirAccelAsymLowPass*)vself;
  self->last_output = input;
  self->cur_raising_ratio = self->raising_ratio;
  self->cur_lowering_ratio = self->lowering_ratio;
}


/**
 * Note that if this is an integer based IIR, the rounding errors can be substantial if the input
 * is small. Test with a step function and see if it reaches 100%.
 */
fc_PTYPE IirAccelAsymLowPass_step(void* vself, fc_PTYPE input)
{
  IirAccelAsymLowPass* self = (IirAccelAsymLowPass*)vself;
  fc_PTYPE result;
  float new_ratio;

  if (self->lowering_ratio > self->raising_ratio) {
    //this is a decaying min hold.
    //it already drops fast, but rises slow.
    //we accelerate the raising.

    bool should_reset_ratio = input < self->last_output;
    float normal_ratio = self->raising_ratio;
    float* accelerated_ratio = &self->cur_raising_ratio;
    float ratio_limit = self->lowering_ratio;

    adjust_coefficients(should_reset_ratio, accelerated_ratio, normal_ratio, ratio_limit);
  }
  else
  {
    //this is a decaying MAX hold.
    //it already rises fast, but drops slow.
    //we accelerate the lowering.

    bool should_reset_ratio = input > self->last_output;
    float normal_ratio = self->lowering_ratio;
    float* accelerated_ratio = &self->cur_lowering_ratio;
    float ratio_limit = self->raising_ratio;

    adjust_coefficients(should_reset_ratio, accelerated_ratio, normal_ratio, ratio_limit);
  }


  if (input > self->last_output) {
    new_ratio = self->cur_raising_ratio;
  }
  else {
    new_ratio = self->cur_lowering_ratio;
  }

  double output = new_ratio * input + (1 - new_ratio) * self->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = round_result(output);
  self->last_output = result;
  return result;
}
