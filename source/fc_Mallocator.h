#pragma once
#include "fc_common.h"
#include "fc_macros.h"

fc_BEGIN_C_DECLS

/**
 * This is just a wrapper around malloc()/free() as optionally over-ridden in fc_config.h.
 * It doesn't have any object data so you can just use this const one.
 */
extern const fc_IAllocator fc_Mallocator;


fc_END_C_DECLS
