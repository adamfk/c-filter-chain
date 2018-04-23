#pragma once

#include "gmock/gmock.h"
#include "gtest/gtest.h"
#include <stdio.h>
#include <stdlib.h>
#include <unordered_map>
#include <stdexcept>
#include "randomization.hpp"


using ::testing::_;
using ::testing::Invoke;
using ::testing::Return;
using ::testing::ReturnNull;
using ::testing::DoDefault;
using ::testing::AtLeast;
using ::testing::AnyNumber;

using std::vector;


struct Allocation {
  void* address;
  size_t size;
};

class MockHeapNotSetup : public std::exception {

};


class Heap
{
  /**
  * tracks allocations and their sizes.
  * Purposely not using array or list as we shouldn't care how elements were inserted, just that they were.
  */
  std::unordered_map<void*, size_t> allocations;

public:

  virtual ~Heap() {
    freeAll();
  }


  /**
  * Returns a copy
  */
  Allocation peakFirstAllocationOrThrow()
  {
    Allocation allocation;

    if (allocations.size() == 0) {
      throw std::out_of_range("it is empty");
    }

    std::unordered_map<void*, size_t>::iterator iterator;
    iterator = allocations.begin();
    allocation.address = iterator->first;
    allocation.size = iterator->second;
    return allocation;
  }


  void* xMalloc(size_t size) {
    void* ptr = malloc(size);
    if (ptr == nullptr) {
      throw std::out_of_range("real OS malloc failed!");
    }

    //fill with random garbage
    Randomization::fill(ptr, size);

    allocations[ptr] = size;
    return ptr;
  }


  void xFree(void* ptr) {
    size_t removed = allocations.erase(ptr);
    if (removed == 0) {
      throw std::out_of_range("nothing found to free");
    }
    if (removed > 1) {
      throw std::out_of_range("too many found to free");
    }
    free(ptr);
  }


  size_t sumAllocationBytes() {
    size_t result = 0;

    std::unordered_map<void*, size_t>::iterator it;
    it = allocations.begin();
    for (it = allocations.begin(); it != allocations.end(); it++)
    {
      void* address = it->first;
      size_t size = it->second;
      result += size;
    }

    return result;
  }


  size_t getAllocationCount() {
    return allocations.size();
  }


  void freeAll() {

    //have to be careful iterating over a map while removing elements from it
    while (allocations.size() > 0) {
      Allocation allocation = peakFirstAllocationOrThrow();
      xFree(allocation.address);
    }
  }

};


/**
* We aren't passing the MockHeap around via an interface as all the calls originate from C.
* There is no need for virtual methods in the base class.
*/
class MockHeap : public Heap {
  MockHeap** c_reference;

public:
  MOCK_METHOD1(xMalloc, void*(size_t size));
  MOCK_METHOD1(xFree, void(void* ptr));


  virtual ~MockHeap() {
    *c_reference = nullptr;
  }

  MockHeap(MockHeap** c_reference) : Heap() {
    if (*c_reference != NULL) {
      ADD_FAILURE() << "mock heap pointer already set!";
    }

    this->c_reference = c_reference;
    *c_reference = this;
    delegateToFakeByDefault();
  }

  // Delegates the default actions of the methods to the fake object.
  // This must be called *before* the custom ON_CALL() statements.
  // See https://github.com/google/googletest/blob/master/googlemock/docs/CookBook.md#delegating-calls-to-a-fake
  void delegateToFakeByDefault() {
    ON_CALL(*this, xMalloc(_))
      .WillByDefault(Invoke(this, &Heap::xMalloc));
    ON_CALL(*this, xFree(_))
      .WillByDefault(Invoke(this, &Heap::xFree));

    //suppress "Uninteresting mock function call - taking default action specified at:" warnings
    EXPECT_CALL(*this, xMalloc(_)).Times(AnyNumber());
    EXPECT_CALL(*this, xFree(_)).Times(AnyNumber());
  }

};


extern MockHeap* mockHeapPtr;


