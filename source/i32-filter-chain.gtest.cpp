#include "user-stuff.h"

#include "gmock/gmock.h"
#include "gtest/gtest.h"
#include <stdio.h>
#include <stdlib.h>

using ::testing::_;
using ::testing::Invoke;
using ::testing::Return;
using ::testing::ReturnNull;
using ::testing::DoDefault;
using ::testing::AtLeast;


//TODO create general macros file

//TODO consider making a filter chain extend the GenericBlock class

//TODO consider throwing error if MockHeap had to free any dangling memory in its destructor

/**
* Macro for getting the size of an array that is known at compile time. Code from Google's Chromium project.
* Taken from http://stackoverflow.com/questions/4415524/common-array-length-macro-for-c
*
* Helps guard against taking the size of a pointer to an array and some other C++ stuff;
*/
#define COUNT_OF(x) ((sizeof(x)/sizeof(0[x])) / ((size_t)(!(sizeof(x) % sizeof(0[x])))))

#include <unordered_map>
#include <stdexcept>





/**
 * tracks allocations and their sizes. Purposely not using array or list as we shouldn't care how elements were inserted, just that they were.
 */
std::unordered_map<void*, size_t> heap_allocations;

class Allocation {
public:
  void* pointer;
  size_t size;
};


Allocation* get_first_allocation()
{
  if (heap_allocations.size() == 0) {
    return NULL;
  }

  std::unordered_map<void*, size_t>::iterator iterator;
  iterator = heap_allocations.begin(); //setup iterator at start
  Allocation* allocation = new Allocation();
  allocation->pointer = iterator->first;
  allocation->size = iterator->second;
  return allocation;
}


class Heap
{
public:
  virtual ~Heap() { }
  virtual void* xMalloc(size_t size) = 0;
  virtual void xFree(void* ptr) = 0;
};


class FakeHeap : Heap
{
public:

  virtual ~FakeHeap() {
    reset();
  }

  virtual void* xMalloc(size_t size) {
    void* ptr = malloc(size);
    heap_allocations[ptr] = size;
    return ptr;
  }

  virtual void xFree(void* ptr) {
    size_t removed = heap_allocations.erase(ptr);
    if (removed == 0) {
      throw std::out_of_range("nothing found to free");
    }
    if (removed > 1) {
      throw std::out_of_range("too many found to free");
    }
    free(ptr);
  }

  virtual void reset() {

    //have to be careful iterating over a map while removing elements from it
    while (heap_allocations.size() > 0) {
      Allocation* allocation = get_first_allocation();
      xFree(allocation->pointer);
    }
  }
};


class MockHeap : public Heap {
public:
  MOCK_METHOD1(xMalloc, void*(size_t size));
  MOCK_METHOD1(xFree, void(void* ptr));
  //MOCK_METHOD0(reset, void());


  //https://github.com/google/googletest/blob/master/googlemock/docs/CookBook.md#delegating-calls-to-a-fake

  // Delegates the default actions of the methods to a FakeFoo object.
  // This must be called *before* the custom ON_CALL() statements.
  void DelegateToFake() {
    ON_CALL(*this, xMalloc(_))
      .WillByDefault(Invoke(&fake_, &FakeHeap::xMalloc));
    ON_CALL(*this, xFree(_))
      .WillByDefault(Invoke(&fake_, &FakeHeap::xFree));
  }

  void DoDefaultXMalloc(size_t size) {
    fake_.xMalloc(size);
  }

private:
  FakeHeap fake_;  // Keeps an instance of the fake in the mock.

};

MockHeap* mockHeapPtr;


void* xMalloc(size_t size) {
  void* ptr = mockHeapPtr->xMalloc(size);
  return ptr;
}

void xFree(void* ptr) {
  mockHeapPtr->xFree(ptr);
}



#include "i32-filter-chain.h"


static void test_chain_against_array(fc32_FilterChain* filter_chain, int32_t const * inputs, int32_t const * expected_outputs, size_t length, int32_t error_tolerance)
{
  int32_t input;
  int32_t expected;
  int32_t output;

  for (size_t i = 0; i < length; i++)
  {
    input = inputs[i];
    expected = expected_outputs[i];
    output = fc32_FilterChain_filter(filter_chain, input);
    EXPECT_NEAR(expected, output, error_tolerance);
  }
}


TEST(FilterChain_i32, OnePassthrough) {

  fcb32_PassThrough p;
  fcb32_PassThrough_new(&p);

  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* filter_blocks[] = {
    &p.block,
  };
  filter_chain.blocks = &filter_blocks[0];
  filter_chain.block_count = COUNT_OF(filter_blocks);
  fc32_FilterChain_setup(&filter_chain);

  for (size_t i = 0; i < 50; i++)
  {
    int32_t input = i;
    int32_t output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_EQ(output, input);
  }

}


TEST(FilterChain_i32, TwoPassthrough) {

  fcb32_PassThrough p1;
  fcb32_PassThrough_new(&p1);

  fcb32_PassThrough p2;
  fcb32_PassThrough_new(&p2);


  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &p1.block,
    &p2.block,
  };
  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);


  for (size_t i = 0; i < 50; i++)
  {
    int32_t input = i;
    int32_t output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_EQ(output, input);
  }
}


TEST(FilterChain_i32, OneIirPrecalc) {

  fcb32_IirLowPass1 iir1;
  fcb32_IirLowPass1_new(&iir1);
  iir1.new_ratio = 0.2f;


  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &iir1.block,
  };
  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);


  const int32_t error_tolerance = 1;
  const int32_t inputs[] =           { 100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100, };
  const int32_t expected_outputs[] = { 20,  36, 49, 59, 67, 74, 79, 83, 87, 89, 91, 93, 95, 96, 96, 97, 98, 98, 99, };
  const size_t length = COUNT_OF(expected_outputs);
  test_chain_against_array(&filter_chain, inputs, expected_outputs, length, error_tolerance);
}



TEST(FilterChain_i32, OneIirDynamicCalc) {

  fcb32_IirLowPass1 iir1;
  fcb32_IirLowPass1_new(&iir1);
  iir1.new_ratio = 0.3f;


  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &iir1.block,
  };
  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);

  const int32_t input = 100;
  const int32_t error_tol = 1;
  int32_t expected;
  int32_t output = 0;
  int32_t difference;

  for (size_t i = 0; i < 50; i++)
  {
    int32_t last_output = output;
    difference = input - last_output;
    expected = (int32_t)(difference * iir1.new_ratio) + last_output;
    output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_NEAR(expected, output, error_tol);
  }
}



TEST(FilterChain_i32, DownSamplerPassthrough) {

  fcb32_PassThrough downsampled_p1;
  fcb32_PassThrough_new(&downsampled_p1);

  fcb32_DownSampler down_sampler;
  fcb32_DownSampler_new(&down_sampler);
  down_sampler.sample_every_x = 2;  //downsample by 2
  fcb32_GenericBlock* downsampled_blocks[] = {
    &downsampled_p1.block,
  };
  down_sampler.sub_chain.blocks = &downsampled_blocks[0];
  down_sampler.sub_chain.block_count = COUNT_OF(downsampled_blocks);


  fc32_FilterChain top_filter_chain = { 0 };
  fcb32_GenericBlock* top_filter_blocks[] = {
    &down_sampler.block,
  };
  top_filter_chain.blocks = &top_filter_blocks[0];
  top_filter_chain.block_count = COUNT_OF(top_filter_blocks);
  fc32_FilterChain_setup(&top_filter_chain);

  const int32_t error_tolerance = 0;
  const int32_t inputs[] =           {1,2,3,4,5,6,7,8,9,10};
  const int32_t expected_outputs[] = {0,2,2,4,4,6,6,8,8,10};
  const size_t length = COUNT_OF(expected_outputs);
  test_chain_against_array(&top_filter_chain, inputs, expected_outputs, length, error_tolerance);
}


TEST(FilterChain_i32, DownSamplerIir) {

  fcb32_IirLowPass1 downsampled_iir;
  fcb32_IirLowPass1_new(&downsampled_iir);
  downsampled_iir.new_ratio = 0.5;

  fcb32_DownSampler down_sampler;
  fcb32_DownSampler_new(&down_sampler);
  down_sampler.sample_every_x = 2;  //downsample by 2
  fcb32_GenericBlock* downsampled_blocks[] = {
    &downsampled_iir.block,
  };
  down_sampler.sub_chain.blocks = &downsampled_blocks[0];
  down_sampler.sub_chain.block_count = COUNT_OF(downsampled_blocks);


  fc32_FilterChain top_filter_chain = { 0 };
  fcb32_GenericBlock* top_filter_blocks[] = {
    &down_sampler.block,
  };
  top_filter_chain.blocks = &top_filter_blocks[0];
  top_filter_chain.block_count = COUNT_OF(top_filter_blocks);
  fc32_FilterChain_setup(&top_filter_chain);

  const int32_t error_tolerance = 0;
  const int32_t inputs[] =           { 100, 100,100, 100,100, 100,100, 100,100, 100 };
  //                       samples = { no,  yes,no,  yes,no,  yes,no,  yes,no,  yes,};
  const int32_t expected_outputs[] = { 0,   50,50,   75,75,   88,88,   94,94,   97 };
  const size_t length = COUNT_OF(expected_outputs);
  test_chain_against_array(&top_filter_chain, inputs, expected_outputs, length, error_tolerance);
}




TEST(FilterChain_i32, MallocDownSamplerIir) {
  MockHeap mockHeap;
  mockHeap.DelegateToFake();
  mockHeapPtr = &mockHeap;

  fc32_FilterChain* filter_chain = fc32_FilterChain_malloc(0,
    fcb32_DownSampler_new_malloc(0, 2, 
      fcb32_IirLowPass1_new_malloc(0.5),
      NULL
    ),
    NULL
  );

  EXPECT_NE(filter_chain, CF_ALLOCATE_FAIL_PTR);
  fc32_FilterChain_setup(filter_chain);

  const int32_t error_tolerance = 0;
  const int32_t inputs[] = { 100, 100,100, 100,100, 100,100, 100,100, 100 };
  //                       samples = { no,  yes,no,  yes,no,  yes,no,  yes,no,  yes,};
  const int32_t expected_outputs[] = { 0,   50,50,   75,75,   88,88,   94,94,   97 };
  const size_t length = COUNT_OF(expected_outputs);
  test_chain_against_array(filter_chain, inputs, expected_outputs, length, error_tolerance);

  fc32_FilterChain_destruct(filter_chain);
}


TEST(FilterChain_i32, TestHeapMocking) {
  {
    MockHeap mockHeap;
    mockHeap.DelegateToFake();
    mockHeapPtr = &mockHeap;

    fcb32_PassThrough* p = fcb32_PassThrough_new_malloc();
    //NOTE! purposely don't destruct filter above

    ASSERT_EQ(heap_allocations.size(), 1);
  }
  //mockHeap has now gone out of scope, assert that it cleaned up
  ASSERT_EQ(heap_allocations.size(), 0);
}


TEST(FilterChain_i32, TestHeapMocking3) {
  MockHeap mockHeap;
  mockHeap.DelegateToFake();
  mockHeapPtr = &mockHeap;

  //see if we can NULL the 3rd returned malloc
  EXPECT_CALL(mockHeap, xMalloc(_)).Times(3)
    .WillOnce(DoDefault())
    .WillOnce(ReturnNull())
    .WillOnce(DoDefault());
  fcb32_PassThrough* p1 = fcb32_PassThrough_new_malloc();
  fcb32_PassThrough* p2 = fcb32_PassThrough_new_malloc(); //RETURN NULL HERE!
  fcb32_PassThrough* p3 = fcb32_PassThrough_new_malloc();

  ASSERT_EQ(heap_allocations.size(), 2);

  EXPECT_NE(p1, CF_ALLOCATE_FAIL_PTR); //NOT equal
  EXPECT_EQ(p2, CF_ALLOCATE_FAIL_PTR);
  EXPECT_NE(p3, CF_ALLOCATE_FAIL_PTR); //NOT equal
}


TEST(FilterChain_i32, MallocSimpleTest) {
  MockHeap mockHeap;
  mockHeap.DelegateToFake();
  
  fcb32_PassThrough* p_filter;
  int expected_size = sizeof(*p_filter);

  EXPECT_CALL(mockHeap, xMalloc(expected_size)).Times(1);
  p_filter = fcb32_PassThrough_new_malloc();
  ASSERT_EQ(heap_allocations.size(), 1);
  Allocation* allocation = get_first_allocation();
  ASSERT_EQ(allocation->size, sizeof(*p_filter));
}


TEST(FilterChain_i32, MallocFailurePassThroughFilter) {
  MockHeap mockHeap;
  mockHeap.DelegateToFake();
  mockHeapPtr = &mockHeap;
  fcb32_PassThrough* p_filter;
  int expected_size = sizeof(*p_filter);

  EXPECT_CALL(mockHeap, xMalloc(_)).Times(1).WillOnce(Return(nullptr));
  p_filter = fcb32_PassThrough_new_malloc();
  EXPECT_EQ(CF_ALLOCATE_FAIL_PTR, p_filter);
}


//TODO test all objects for malloc failure

TEST(FilterChain_i32, MallocFailureInChain1) {
  MockHeap mockHeap;
  mockHeap.DelegateToFake();
  mockHeapPtr = &mockHeap;


  EXPECT_CALL(mockHeap, xMalloc(_)).Times(AtLeast(3))
    .WillOnce(DoDefault())  //0.42 IIR
    .WillOnce(ReturnNull()) //0.41 IIR  //RETURN NULL
    .WillRepeatedly(DoDefault()) //rest of filters
    ;

  EXPECT_CALL(mockHeap, xFree(_)).Times(AtLeast(1));

  fc32_FilterChain* filter_chain = fc32_FilterChain_malloc(0,
    fcb32_DownSampler_new_malloc(0, 2,
      fcb32_IirLowPass1_new_malloc(0.40f),
      fcb32_IirLowPass1_new_malloc(0.41f),
      fcb32_IirLowPass1_new_malloc(0.42f),
      NULL
    ),
    NULL
  );

  EXPECT_EQ(filter_chain, CF_ALLOCATE_FAIL_PTR);
  EXPECT_EQ(heap_allocations.size(), 0);
}



int main(int argc, char** argv) {
  ::testing::InitGoogleMock(&argc, argv);
  int result = RUN_ALL_TESTS();
  return result;
}