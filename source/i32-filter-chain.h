
#pragma once;

//TODO PUT user space
#define CFC_MALLOC_FUNC xMalloc
#define CFC_FREE_FUNC xFree


#undef FILTER_CHAIN_TYPE
#undef FILTER_CHAIN_NAME_PREFIX

#define FILTER_CHAIN_NAME_PREFIX 32
#define FILTER_CHAIN_TYPE int32_t

#include "c-filter-chain.h"

