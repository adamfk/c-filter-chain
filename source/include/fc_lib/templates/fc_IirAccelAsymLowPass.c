
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


IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio)
{
  IirAccelAsymLowPass* self = allocate_or_ret_fail_ptr(bc, sizeof(IirAccelAsymLowPass));

  if (is_ok_ptr(self)) {
    IirAccelAsymLowPass_ctor(self);
    self->rise_faster = rise_faster;
    self->fast_ratio = fast_ratio;
    self->slow_ratio = slow_ratio;
  }

  fc_BuildCtx_update_success_from_ptr(bc, self);

  return self;
}


IBlock* IirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio)
{
  IirAccelAsymLowPass* result = IirAccelAsymLowPass_new(bc, rise_faster, fast_ratio, slow_ratio);
  return (IBlock*)result;
}


/**
 * Class method.
 * Use to check if an IBlock is a IirAccelAsymLowPass block.
 */
bool IirAccelAsymLowPass_Test_type(void* void_block)
{
  IBlock* iblock = (IBlock*)void_block;
  bool result = iblock->vtable->step == IirAccelAsymLowPass_vtable.step;
  return result;
}





//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAccelAsymLowPass_preload(void* vself, fc_PTYPE input)
{
  IirAccelAsymLowPass* self = (IirAccelAsymLowPass*)vself;
  self->last_output = input;
  self->accelerated_slow_ratio = self->slow_ratio;
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

  typedef enum AccelAction
  {
    AccelAction_INCREASE,
    AccelAction_DECREASE,
  } AccelAction;

  AccelAction accel_action = AccelAction_DECREASE;

  if (self->rise_faster) 
  {
    //this is a decaying MAX hold.
    //it rises fast, but lowers slow.
    //we accelerate the lowering.

    if (input >= self->last_output) {
      new_ratio = self->fast_ratio;
    } else {
      accel_action = AccelAction_INCREASE;
      new_ratio = self->accelerated_slow_ratio;
    }
  }
  else
  {
    //this is a decaying min hold.
    //it lowers fast, but rises slow.
    //we accelerate the raising.

    if (input <= self->last_output) {
      new_ratio = self->fast_ratio;
    } else {
      accel_action = AccelAction_INCREASE;
      new_ratio = self->accelerated_slow_ratio;
    }
  }

  double output = new_ratio * input + (1 - new_ratio) * self->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = round_result(output);
  self->last_output = result;

  //adjust accelerated_slow_ratio for next iteration
  //TODO consider having below acceleration parameters be adjustable
  const float INCREASE_BY = 0.10f;  //0.05 good for slowish
  const float DECREASE_BY = 0.20f;  //See https://github.com/adamfk/c-filter-chain/issues/20 

  switch (accel_action)
  {
    case AccelAction_INCREASE:
      self->accelerated_slow_ratio *= 1 + INCREASE_BY;
      break;

    default:
    case AccelAction_DECREASE:
      self->accelerated_slow_ratio *= 1 - DECREASE_BY;
      break;
  }
  ENSURE_BETWEEN(self->slow_ratio, self->accelerated_slow_ratio, self->fast_ratio);

  return result;
}
