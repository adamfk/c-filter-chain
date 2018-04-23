#pragma once

#include <stddef.h>
#include <stdint.h>
#include "fc_macros.h"
#include "fc_IAllocator.h"
#include "fc_Builder.h"
#include "fc_IVisitor.h"


fc_BEGIN_C_DECLS

void fc_destruct_and_free(void* block, fc_IAllocator const * allocator);

void fc_run_visitor(fc_IVisitor* visitor, void* iblock);

fc_END_C_DECLS

