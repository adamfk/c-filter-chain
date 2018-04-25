
/*
  IBlock is an interface and should only wrap `vtable` access.
*/

fc_PTYPE IBlock_step(IBlock* self, fc_PTYPE input) {
  return self->vtable->step(self, input);
}

void IBlock_preload(IBlock* self, fc_PTYPE input) {
  self->vtable->preload(self, input);
}

void IBlock_destruct_fields(IBlock* self, fc_IAllocator const * allocator) {
  self->vtable->destruct_fields(self, allocator);
}

void IBlock_run_visitor(IBlock* self, fc_IVisitor* visitor) {
  self->vtable->run_visitor(self, visitor);
}




