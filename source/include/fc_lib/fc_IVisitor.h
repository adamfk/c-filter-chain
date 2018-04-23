#pragma once
#include "fc_lib/fc_macros.h"

fc_BEGIN_C_DECLS

//forward declare
typedef struct fc_IVisitor_ fc_IVisitor;


/**
 * A "proper" Visitor vtable would have a function pointer for every IBlock type, but that may end up
 * being significantly wasteful for embedded systems if we develop a large number of blocks.
 */
typedef struct fc_IVisitorVtable_
{
  /**
   * @param iblock should be of type IBlock
   */
  void (*visit)(fc_IVisitor* self, void* iblock);

} fc_IVisitorVtable;


struct fc_IVisitor_
{
  fc_IVisitorVtable const * vtable;
};


void fc_IVisitor_visit(fc_IVisitor* self, void* iblock);

fc_END_C_DECLS