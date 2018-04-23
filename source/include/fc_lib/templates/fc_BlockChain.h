
#define BlockChain                  FC_MAKE_NAME(BlockChain)
#define BlockChain_ctor             FC_MAKE_NAME(BlockChain_ctor)
#define BlockChain_preload          FC_MAKE_NAME(BlockChain_preload)
#define BlockChain_step           FC_MAKE_NAME(BlockChain_step)
#define BlockChain_new              FC_MAKE_NAME(BlockChain_new)
#define BlockChain_allocate_fields  FC_MAKE_NAME(BlockChain_allocate_fields)
#define BlockChain_destruct_fields  FC_MAKE_NAME(BlockChain_destruct_fields)
#define BlockChain_destruct_entire  FC_MAKE_NAME(BlockChain_destruct_entire)
#define BlockChain_visit            FC_MAKE_NAME(BlockChain_visit)

#define BlockChain_Test_type        FC_MAKE_NAME(BlockChain_Test_type)


//TODOLOW create a convenience class AllocatedBlock that combines an allocator and a single block.
//Would save you the overhead of creating another BlockChain just to use a single block from a different allocation.


/**
 * Assumes same allocation method for both BlockChain and `blocks` field.
 * 
 * All directly contained blocks of a BlockChain must have the same allocation as the BlockChain unless they are BlockChain.
 * Said another way, all blocks other a BlockChain (or BlockChain subclass) must have the same allocation as the enclosing BlockChain.
 * This allows knowing how to destroy each block without storing an allocator reference in each block. It also allows mixing and matching
 * allocations as long as the above rule is used.
 * TODO: write tests for above
 * 
 * TODO look into ways of detecting that all contained blocks follow above rule. It needs to be c code for detection as it
 * would be a runtime method available to the user to check their setup.
 *   Could potentially create another virtual method called `get_allocated_size(self, allocator)` that would return the number of bytes
 *   that would have been allocated from the specified allocator. User could potentially inspect allocator's actual used bytes
 *   and compare against what `get_allocated_size()` returned.
 */
typedef struct BlockChain
{
  IBlock block;    //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE

  /**
   * Allows passing destructor to contained blocks.
   */
  const fc_Builder* builder_config;
  IBlock **blocks; //!< array of pointers to blocks. DO NOT manually adjust if auto allocated via "new()" methods.
  uint16_t block_count;
} BlockChain;



void BlockChain_ctor(BlockChain* filter_chain);

BlockChain* BlockChain_new(fc_Builder* bc, IBlock** block_list);

/**
 * user code should generally not call.
 */
bool BlockChain_allocate_fields(fc_Builder* bc, BlockChain* filter_chain, IBlock** block_list);

/**
 * Will destruct fields and free self.
 */
void BlockChain_destruct_entire(BlockChain* fc);

bool BlockChain_Test_type(IBlock* some_block);



//##################################################################
// IBlock interface methods
//##################################################################

void BlockChain_preload(void* self, fc_Type input);

fc_Type BlockChain_step(void* self, fc_Type input);

/**
 * user code should prefer to call `BlockChain_destruct_entire( )` instead.
 */
void BlockChain_destruct_fields(void* self, fc_IAllocator const * allocator);

void BlockChain_visit(void* self, fc_IVisitor* visitor);


