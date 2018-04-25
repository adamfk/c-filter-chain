
#define PassThrough_vtable FC_MAKE_NAME(PassThrough_vtable)

//TODO audit all and make static
const IBlockVirtualTable PassThrough_vtable = {
  .step = PassThrough_step,
  .preload = PassThrough_preload,
  .destruct_fields = destruct_no_fields,
  .run_visitor = simple_run_visitor,
};


void PassThrough_ctor(PassThrough* passThrough)
{
  fc_ZERO_STRUCT(*passThrough);
  passThrough->block.vtable = &PassThrough_vtable;
}


/**
* Returns #fc_ALLOCATE_FAIL_PTR on allocate failure.
*/
PassThrough* PassThrough_new(fc_BuildCtx* bc)
{
  PassThrough* self = allocate_or_ret_fail_ptr(bc, sizeof(PassThrough));
  if (is_ok_ptr(self)) {
    PassThrough_ctor(self);
  }

  fc_BuildCtx_update_success_from_ptr(bc, self);

  return self;
}


IBlock* PassThrough_new_iblock(fc_BuildCtx* bc) {
  return (IBlock*)PassThrough_new(bc);
}


/**
 * Class method.
 * Use to check if an IBlock is a PassThrough block.
 */
bool PassThrough_Test_type(void* some_block)
{
  IBlock* block = (IBlock*)some_block;
  bool result = block->vtable->step == PassThrough_vtable.step;
  return result;
}



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void PassThrough_preload(void* self, fc_PTYPE input)
{
  (void)self; (void)input;
}


fc_PTYPE PassThrough_step(void* self, fc_PTYPE input)
{
  (void)self; (void)input;
  return input;
}

