#pragma once
#include "fc_lib/fc_macros.h"

/*
  This visitor interface is used to "visit" every block in a BlockChain.

  It differs from the standard "Visitor" pattern in the following ways:

  - it has "entered()" and "exited()" call backs instead of a single "visit()"
      - this is particularly useful for generating a diagram with nested Blocks.

  - its vtable does not have a function pointer for every IBlock type. Instead, visitors
    have to inspect the type of each IBlock. This is an intentional design choice
    to favor smaller resource usage over faster execution. Especially as we may
    end up developing a large number of blocks.

  - instead of an "accept()" method, IBlocks have a "run_visitor()" method.
      - just a naming preference for clarity.

*/

fc_BEGIN_C_DECLS

//forward declare
typedef struct fc_IVisitor_ fc_IVisitor;

/**
 * Defines the methods in an IVisitor interface/object.
 */
typedef struct fc_IVisitorVtable_
{
  /**
   * @param iblock should be of type IBlock
   */
  void (*block_entered)(fc_IVisitor* self, void* iblock);

  /**
   * @param iblock should be of type IBlock
   */
  void (*block_exited)(fc_IVisitor* self, void* iblock);

} fc_IVisitorVtable;


struct fc_IVisitor_
{
  fc_IVisitorVtable const * vtable;
};


void fc_IVisitor_block_entered(fc_IVisitor* self, void* iblock);
void fc_IVisitor_block_exited(fc_IVisitor* self, void* iblock);

fc_END_C_DECLS