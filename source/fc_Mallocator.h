#pragma once
#include "c-filter-chain-common.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
  * This is just a wrapper around malloc()/free(). It doesn't have any object data
  * so you can just use this const one.
  */
extern const fc_AbstractAllocator fc_Mallocator;

#ifdef __cplusplus
}
#endif