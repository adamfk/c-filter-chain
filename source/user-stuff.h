#pragma once


#ifdef __cplusplus
extern "C" {
#endif


void* xMalloc(size_t size);
void xFree(void* ptr);


#ifdef __cplusplus
}
#endif
