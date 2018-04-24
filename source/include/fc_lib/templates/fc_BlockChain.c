
#define BlockChain_vtable FC_MAKE_NAME(BlockChain_vtable)

const IBlockVirtualTable BlockChain_vtable = {
  .step = BlockChain_step,
  .preload = BlockChain_preload,
  .destruct_fields = BlockChain_destruct_fields,
  .run_visitor = BlockChain_visit,
};


void BlockChain_ctor(BlockChain* fc)
{
  fc_ZERO_STRUCT(*fc);
  fc->block.vtable = &BlockChain_vtable;
}


/**
 * Class method.
 * Use to check if an IBlock is a BlockChain.
 */
bool BlockChain_Test_type(IBlock* some_block)
{
  bool result = some_block->vtable->step == BlockChain_vtable.step;
  return result;
}


/**
 * NOTE! `self` is allowed be NULL or fail pointer.
 * blocks list MUST BE NULL TERMINATED!
 * TODO: fail if an empty chain?
 * Returns success
 */
bool BlockChain_allocate_fields(fc_BuildCtx* bc, BlockChain* self, IBlock** block_list)
{
  bool success = false;
  bool child_allocate_fail = false;
  uint16_t total_block_count = 0;      //TODO make a typedef for chain blocks count size
  IBlock** block_array = NULL;

  const fc_IAllocator* allocator = bc->allocator;


  total_block_count = count_list_size(block_list);

  //try to allocate block array
  //NOTE: we specifically want to try and allocate before checking for bad `self` as this allows
  // checking how big the chain would actually be.
  block_array = fc_allocate(allocator, total_block_count * sizeof(block_array[0]));

  if (!block_array) {
    goto fail_destroy_block_list;
  }

  if (is_bad_ptr(self)) {
    goto fail_destroy_block_list;
  }

  child_allocate_fail = test_and_copy_blocks(block_array, block_list, total_block_count);

  if (child_allocate_fail) {
    fc_free(allocator, block_array);
    goto fail_destroy_block_list;
  }

  self->builder_config = bc;
  self->blocks = block_array;
  self->block_count = total_block_count;
  success = true;
  goto done;


fail_destroy_block_list:
  fc_destruct_gb_list(allocator, block_list);

done:
  return success;
}



/**
 * block_list MUST BE NULL TERMINATED!
 * Arguments should all be of type IBlock* or NULL.
 * 
 * TODO: consider making a function that tries to determine if a passed in block is bogus
 * to detect someone forgetting to NULL terminate the list.
 * 
 * TODOLOW: this could be moved to common file
 * 
 * Returns #fc_ALLOCATE_FAIL_PTR if this or a passed block failed allocation.
 */
BlockChain* BlockChain_new(fc_BuildCtx* bc, IBlock** block_list)
{
  BlockChain* self;
  bool success = true;

  self = allocate_or_ret_fail_ptr(bc, sizeof(*self));

  if (is_ok_ptr(self)) {
    BlockChain_ctor(self);
  }

  //Intentionally try to allocate fields even if above allocation failed.
  //This allows determining total required size with an empty allocator that just sums requests.
  success = BlockChain_allocate_fields(bc, self, block_list);

  //if allocated self, but fields failed
  if (is_ok_ptr(self) && !success) {
    fc_free(bc->allocator, self);
    self = fc_ALLOCATE_FAIL_PTR;
  }

  fc_BuildCtx_update_success_from_ptr(bc, self);

  return self;
}


void BlockChain_destruct_entire(BlockChain* fc)
{
  fc_destruct_and_free(&fc->block, fc->builder_config->allocator);
}


//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void BlockChain_destruct_fields(void* vself, fc_IAllocator const * allocator)
{
  BlockChain* self = (BlockChain*)vself;

  allocator = NULL; //ignore passed in allocator as we have our own

  if (self->builder_config) {
    allocator = self->builder_config->allocator;
  }

  destruct_block_array(allocator, self->blocks, self->block_count);
  fc_free(allocator, self->blocks);
}


void BlockChain_preload(void* vself, fc_Type input)
{
  BlockChain* self = (BlockChain*)vself;

  for (size_t i = 0; i < self->block_count; i++)
  {
    IBlock* block = self->blocks[i];
    IBlock_preload(block, input);
  }
}


fc_Type BlockChain_step(void* vself, fc_Type input)
{
  fc_Type output = 0;
  BlockChain* self = (BlockChain*)vself;

  for (size_t i = 0; i < self->block_count; i++)
  {
    IBlock* block = self->blocks[i];
    output = IBlock_step(block, input);
    input = output;
  }

  return output;
}



void BlockChain_visit(void* vself, fc_IVisitor* visitor)
{
  BlockChain* self = (BlockChain*)vself;

  fc_IVisitor_visit(visitor, &self->block);

  for (size_t i = 0; i < self->block_count; i++)
  {
    IBlock* block = self->blocks[i];
    IBlock_run_visitor(block, visitor);
  }
}

