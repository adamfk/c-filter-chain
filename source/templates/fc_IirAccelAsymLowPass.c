
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

IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_Builder* bc, float higher_ratio, float lower_ratio)
{
  IirAccelAsymLowPass* p = allocate_or_ret_fail_ptr(bc, sizeof(IirAccelAsymLowPass));

  if (is_ok_ptr(p)) {
    IirAccelAsymLowPass_ctor(p);
    p->higher_ratio = higher_ratio;
    p->lower_ratio = lower_ratio;
    p->cur_higher_ratio = p->higher_ratio;
    p->cur_lower_ratio = p->lower_ratio;
  }

  return p;
}

IBlock* IirAccelAsymLowPass_new_iblock(fc_Builder* bc, float higher_ratio, float lower_ratio)
{
  IirAccelAsymLowPass* result = IirAccelAsymLowPass_new(bc, higher_ratio, lower_ratio);
  return (IBlock*)result;
}

void IirAccelAsymLowPass_preload(IirAccelAsymLowPass* iir, fc_Type input)
{
  iir->last_output = input;
  iir->cur_higher_ratio = iir->higher_ratio;
  iir->cur_lower_ratio = iir->lower_ratio;
}


static void adjust_coefficients(bool reset, float* cur_ratio, float normal_ratio, float ratio_limit)
{

  if (reset) {
    *cur_ratio *= 0.3f;
    ENSURE_NOT_LOWER_THAN(*cur_ratio, normal_ratio);
  } else {
    *cur_ratio *= 1.1f; //1.05 good for slowish
    ENSURE_NOT_HIGHER_THAN(*cur_ratio, ratio_limit);
  }
  
}


/**
* Note that if this is an integer based IIR, the rounding errors can be substantial if the input
* is small. Test with a step function and see if it reaches 100%.
*/
fc_Type IirAccelAsymLowPass_step(IirAccelAsymLowPass* iir, fc_Type input)
{
  fc_Type result;
  float new_ratio;

  if (iir->lower_ratio > iir->higher_ratio) {
    //this is a decaying min hold.
    //it already drops fast, but rises slow.
    //we accelerate the rising.

    bool reset_ratio = input < iir->last_output;
    float normal_ratio = iir->higher_ratio;
    float* accelerated_ratio = &iir->cur_higher_ratio;
    float ratio_limit = iir->lower_ratio;

    adjust_coefficients(reset_ratio, accelerated_ratio, normal_ratio, ratio_limit);
  }
  else 
  {
    //this is a decaying MAX hold.
    //it already rises fast, but drops slow.
    //we accelerate the drop.

    bool reset_ratio = input > iir->last_output;
    float normal_ratio = iir->lower_ratio;
    float* accelerated_ratio = &iir->cur_lower_ratio;
    float ratio_limit = iir->higher_ratio;

    adjust_coefficients(reset_ratio, accelerated_ratio, normal_ratio, ratio_limit);
  }


  if (input > iir->last_output) {
    new_ratio = iir->cur_higher_ratio;
  }
  else {
    new_ratio = iir->cur_lower_ratio;
  }

  double output = new_ratio * input + (1 - new_ratio) * iir->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = (fc_Type)(output + 0.5); //TODO make rounding type generic. and respects negative numbers.
  iir->last_output = result;
  return result;
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