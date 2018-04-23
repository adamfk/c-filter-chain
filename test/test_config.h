/*
  This file sets up config options for unit testing
*/
#pragma once

#include "fc_lib/fc_macros.h"
#include <stddef.h>

#undef fc_MALLOC_FUNC
#undef fc_FREE_FUNC


#define fc_MALLOC_FUNC xMalloc
#define fc_FREE_FUNC xFree


fc_BEGIN_C_DECLS


void* xMalloc(size_t size);
void xFree(void* ptr);


fc_END_C_DECLS
