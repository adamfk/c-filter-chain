#include "fc_lib/fc_IVisitor.h"


void fc_IVisitor_block_entered(fc_IVisitor* self, void* iblock)
{
  self->vtable->block_entered(self, iblock);
}


void fc_IVisitor_block_exited(fc_IVisitor* self, void* iblock)
{
  self->vtable->block_exited(self, iblock);
}