

#define IBlock                   FC_MAKE_NAME(IBlock)
#define IBlock_run_visitor       FC_MAKE_NAME(IBlock_run_visitor)
#define IBlock_step              FC_MAKE_NAME(IBlock_step)
#define IBlock_preload           FC_MAKE_NAME(IBlock_preload)
#define IBlock_destruct_fields   FC_MAKE_NAME(IBlock_destruct_fields)
#define IBlockVirtualTable       FC_MAKE_NAME(IBlockVirtualTable)



//need to forward declare IBlock for following declarations.
typedef struct IBlock IBlock;

/**
 * The Virtual Table that points to the actual functions to use for the object that implements
 * this interface.
 * 
 * NOTE that some methods may be NULL.
 */
typedef struct IBlockVirtualTable
{
  /**
   * This function takes an input and produces an output. It should be called at a regular interval.
   * It may affect the internal state of the filter.
   */
  fc_PTYPE (*step)(void* self, fc_PTYPE input);

  /**
   * This function is supposed to preload a filter so that it is at a particular state.
   * This is often useful to do before the first sample is fed to a filter.
   */
  void (*preload)(void* self, fc_PTYPE input);

  /**
   * User code should not call directly. Use `IBlock_destruct_fields( )` instead.
   * This function should destruct & de-allocate all the fields within an IBlock instance, but should not
   * free the memory to the block itself as you should use `fc_destruct_and_free( )` for that.
   */
  void (*destruct_fields)(void* self, fc_IAllocator const * allocator);

  /**
   * Use to recursively visit all blocks in a chain.
   * Allowed to be NULL for blocks that don't have sub-blocks.
   * TODOLOW: make visitor be an object that can encapsulate data as well.
   */
  void (*run_visitor)(void* self, fc_IVisitor* visitor);

} IBlockVirtualTable;


/**
 * filter block interface structure
 */
struct IBlock
{
  /**
   * Prefer not accessing `vtable` directly in case we refactor in the future.
   * Use IBlock methods like `IBlock_step( )` instead which provide a thin wrapper
   * and should be inlined by the compiler anyway.
   */
  IBlockVirtualTable const * vtable;
};


fc_PTYPE IBlock_step(IBlock* self, fc_PTYPE input);
void IBlock_destruct_fields(IBlock* self, fc_IAllocator const * allocator);
void IBlock_run_visitor(IBlock* self, fc_IVisitor* visitor);
void IBlock_preload(IBlock* self, fc_PTYPE input);

