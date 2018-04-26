

#define DownSampler_vtable FC_MAKE_NAME(DownSampler_vtable)

const IBlockVirtualTable DownSampler_vtable = {
  .step = DownSampler_step,
  .preload = DownSampler_preload,
  .destruct_fields = BlockChain_destruct_fields,  //inherit from parent
  .run_visitor = BlockChain_run_visitor, //inherit from parent
};



void DownSampler_ctor(DownSampler* down_sampler)
{
  fc_ZERO_STRUCT(*down_sampler);
  BlockChain_ctor(&down_sampler->base_fc_instance); //construct super class
  down_sampler->base_fc_instance.block.vtable = &DownSampler_vtable;
}


BlockChain* DownSampler_cast_to_fc(DownSampler* self)
{
  BlockChain* base_fc = (BlockChain*)self; //OK because `base_fc_instance` is first member in struct.
  return base_fc;
}


/**
 * block_list MUST BE NULL TERMINATED!
 * SEE #BlockChain_new for usage.
 */
DownSampler* DownSampler_new(fc_BuildCtx* bc, uint16_t sample_every_x, IBlock** block_list)
{
  DownSampler* self;
  self = allocate_or_ret_fail_ptr(bc, sizeof(DownSampler));

  if (is_ok_ptr(self)) {
    DownSampler_ctor(self);
    self->sample_every_x = sample_every_x;
    //self->sample_count = 0; //not needed as zerod in ctor
  }

  //Intentially try allocating fields even if above failed.
  //See `BlockChain_new( )` for details.
  BlockChain* base_fc = DownSampler_cast_to_fc(self);
  bool inner_malloc_success = BlockChain_allocate_fields(bc, base_fc, block_list);

  if (is_ok_ptr(self) && !inner_malloc_success) {
    fc_free(bc->allocator, self);
    self = fc_ALLOCATE_FAIL_PTR;
  }

  fc_BuildCtx_update_success_from_ptr(bc, self);

  return self;
}


IBlock* DownSampler_new_iblock(fc_BuildCtx* bc, uint16_t sample_every_x, IBlock** block_list)
{
  return (IBlock*)DownSampler_new(bc, sample_every_x, block_list);
}


/**
 * Class method.
 * Use to check if an IBlock is a DownSampler block.
 */
bool DownSampler_Test_type(IBlock* some_block)
{
  bool result = some_block->vtable->step == DownSampler_vtable.step;
  return result;
}



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void DownSampler_preload(void* vself, fc_PTYPE input)
{
  DownSampler* self = (DownSampler*)vself;
  self->latched_output = input;
  BlockChain_preload(&self->base_fc_instance, input);
}


fc_PTYPE DownSampler_step(void* vself, fc_PTYPE input)
{
  DownSampler* self = (DownSampler*)vself;
  self->sample_count++;

  if (self->sample_count >= self->sample_every_x)
  {
    self->latched_output = BlockChain_step(&self->base_fc_instance, input);
    self->sample_count = 0;
  }

  return self->latched_output;
}

