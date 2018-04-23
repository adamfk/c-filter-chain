#include "fc_IVisitor.h"


void fc_IVisitor_visit(fc_IVisitor* self, void* iblock)
{
  self->vtable->visit(self, iblock);
}
