#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "fc_lib/fc_macros.h"
#include "fc_lib/fc_IAllocator.h"

fc_BEGIN_C_DECLS

/**
 * This is a special pointer value to indicate an allocation failure.
 * The fc lib uses NULL to terminate lists and needs this special pointer
 * value to be able to detect a nested allocation failure.
 */
extern void const * const fc_ALLOCATE_FAIL_PTR;


void* fc_allocate(fc_IAllocator const * const allocator, size_t size);
void fc_free(fc_IAllocator const * const allocator, void* address);

bool is_ok_ptr(const void* ptr);  //TODO rename
bool is_bad_ptr(const void* ptr);

fc_END_C_DECLS




