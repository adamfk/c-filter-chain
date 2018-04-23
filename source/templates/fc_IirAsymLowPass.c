

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

IirAsymLowPass* IirAsymLowPass_new(fc_Builder* bc, float higher_ratio, float lower_ratio)
{
  IirAsymLowPass* p = allocate_or_ret_fail_ptr(bc, sizeof(IirAsymLowPass));

  if (is_ok_ptr(p)) {
    IirAsymLowPass_ctor(p);
    p->higher_ratio = higher_ratio;
    p->lower_ratio = lower_ratio;
  }

  return p;
}

IBlock* IirAsymLowPass_new_iblock(fc_Builder* bc, float higher_ratio, float lower_ratio)
{
  IirAsymLowPass* result = IirAsymLowPass_new(bc, higher_ratio, lower_ratio);
  return (IBlock*)result;
}

void IirAsymLowPass_preload(IirAsymLowPass* iir, fc_Type input)
{
  iir->last_output = input;
}


/**
* Note that if this is an integer based IIR, the rounding errors can be substantial if the input
* is small. Test with a step function and see if it reaches 100%.
*/
fc_Type IirAsymLowPass_step(IirAsymLowPass* iir, fc_Type input)
{
  fc_Type result;
  float new_ratio;

  if (input > iir->last_output) {
    new_ratio = iir->higher_ratio;
  }
  else {
    new_ratio = iir->lower_ratio;
  }

  double output = new_ratio * input + (1 - new_ratio) * iir->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = (fc_Type)(output + 0.5); //TODO make rounding type generic. and respects negative numbers.
  iir->last_output = result;
  return result;
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
