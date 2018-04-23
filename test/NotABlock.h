#pragma once
#include <stdint.h>
#include "fc_lib/fc_macros.h"
#include "fc_lib/fc_IAllocator.h"
#include "fc_lib/fc_IVisitor.h"


/*
  This implements a generic IBlock for use with testing types against.
  See tests in TestCommon.cpp that ensure that it mirrors an IBlock structure.
*/

fc_BEGIN_C_DECLS

//meant to be an exact mirror of an IBlockVirtualTable
typedef struct NotABlockVirtualTable
{
  int32_t (*step)(void* self, int32_t input);
  void (*preload)(void* self, int32_t input);
  void (*destruct_fields)(void* self, fc_IAllocator const * allocator);
  void (*run_visitor)(void* self, fc_IVisitor* visitor);
} NotABlockVirtualTable;


typedef struct NotABlock
{
  NotABlockVirtualTable const * vtable;
} NotABlock;


void NotABlock_ctor(NotABlock* block);

fc_END_C_DECLS
