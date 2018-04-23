#include <stdexcept>
#include "MockHeap.hpp"
#include "fc_default_config.h"

MockHeap* mockHeapPtr;


static void throwIfMockNotSetup() {
  if (mockHeapPtr == nullptr) {
    throw MockHeapNotSetup();
  }
}

void* xMalloc(size_t size) {
  throwIfMockNotSetup();
  void* ptr = mockHeapPtr->xMalloc(size);
  return ptr;
}

void xFree(void* ptr) {
  throwIfMockNotSetup();
  mockHeapPtr->xFree(ptr);
}