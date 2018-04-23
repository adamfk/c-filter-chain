
#define IirLowPass_vtable FC_MAKE_NAME(fc_IirLowPass_vtable)

const IBlockVirtualTable IirLowPass_vtable = {
  .step = IirLowPass_step,
  .preload = IirLowPass_preload,
  .destruct_fields = destruct_no_fields,
  .run_visitor = simple_run_visitor,
};


void IirLowPass_ctor(IirLowPass* iir)
{
  fc_ZERO_STRUCT(*iir);
  iir->block.vtable = &IirLowPass_vtable;
}

IirLowPass* IirLowPass_new(fc_Builder* bc, float new_ratio)
{
  IirLowPass* p = allocate_or_ret_fail_ptr(bc, sizeof(IirLowPass));

  if (is_ok_ptr(p)) {
    IirLowPass_ctor(p);
    p->new_ratio = new_ratio;
  }

  return p;
}

IBlock* IirLowPass_new_iblock(fc_Builder* bc, float new_ratio)
{
  IirLowPass* result = IirLowPass_new(bc, new_ratio);
  return (IBlock*)result;
}

void IirLowPass_preload(IirLowPass* iir, fc_Type input)
{
  iir->last_output = input;
}


/**
* Note that if this is an integer based IIR, the rounding errors can be substantial if the input
* is small. Test with a step function and see if it reaches 100%.
*/
fc_Type IirLowPass_step(IirLowPass* iir, fc_Type input)
{
  fc_Type result;
  double output = iir->new_ratio * input + (1 - iir->new_ratio) * iir->last_output;  //TODO rewrite in efficient form. TODO use generic type numerator and denominator instead of floating point
  result = (fc_Type)(output + 0.5); //TODO make rounding type generic. and respects negative numbers.
  iir->last_output = result;
  return result;
}


/**
 * Class method.
 * Use to check if an IBlock is a IirLowPass.
 */
bool IirLowPass_Test_type(IBlock* some_block)
{
  bool result = some_block->vtable->step == IirLowPass_vtable.step;
  return result;
}

