#pragma once

#include <stdlib.h>

extern "C" {

  void* xMalloc(size_t size);

  void xFree(void* ptr);
}