#pragma once

#define fc_MALLOC_FUNC xMalloc
#define fc_FREE_FUNC xFree

#ifdef __cplusplus
extern "C" {
#endif


void* xMalloc(size_t size);
void xFree(void* ptr);


#ifdef __cplusplus
}
#endif
