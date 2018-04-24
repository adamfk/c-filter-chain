#include "fc_default_config.h"

#include "fc_lib/fc_allocate.h"
#include "fc_lib/fc_Mallocator.h"
#include "fc_lib/fc_CountAllocator.h"

#include "gmock/gmock.h"
#include "gtest/gtest.h"
#include <stdio.h>
#include <stdlib.h>

#include "MockHeap.hpp"


using ::testing::_;
using ::testing::Invoke;
using ::testing::Return;
using ::testing::ReturnNull;
using ::testing::DoDefault;
using ::testing::AtLeast;

//
//using std::vector;
//
//static fc_BuildCtx mbc = {
//  &fc_Mallocator,
//};
//
//
//
//
//
//
//
//
//TEST(TestSetup, MockNotSetup) {
//  ASSERT_THROW(xMalloc(12), MockHeapNotSetup);
//  ASSERT_THROW(xFree(nullptr), MockHeapNotSetup);
//  MockHeap mockHeap(&mockHeapPtr);
//  ASSERT_NO_THROW(xMalloc(12));
//}
//
//
//
//#include "fc_lib/fc32_lib.h"
//
//
//static void test_chain_against_array(fc32_BlockChain* filter_chain, int32_t const * inputs, int32_t const * expected_outputs, size_t length, int32_t error_tolerance)
//{
//  int32_t input;
//  int32_t expected;
//  int32_t output;
//
//  for (size_t i = 0; i < length; i++)
//  {
//    input = inputs[i];
//    expected = expected_outputs[i];
//    output = fc32_BlockChain_step(filter_chain, input);
//    EXPECT_NEAR(expected, output, error_tolerance);
//  }
//}
//
//
//TEST(BlockChain_i32, OnePassthrough) {
//
//  fc32_PassThrough p;
//  fc32_PassThrough_ctor(&p);
//
//  fc32_BlockChain filter_chain = { 0 };
//  fc32_IBlock* filter_blocks[] = {
//    &p.block,
//  };
//  filter_chain.blocks = &filter_blocks[0];
//  filter_chain.block_count = fc_COUNTOF(filter_blocks);
//  fc32_BlockChain_preload(&filter_chain, 0);
//
//  for (size_t i = 0; i < 50; i++)
//  {
//    int32_t input = i;
//    int32_t output = fc32_BlockChain_step(&filter_chain, input);
//    EXPECT_EQ(output, input);
//  }
//
//}
//
//
//TEST(BlockChain_i32, TwoPassthrough) {
//
//  fc32_PassThrough p1;
//  fc32_PassThrough_ctor(&p1);
//
//  fc32_PassThrough p2;
//  fc32_PassThrough_ctor(&p2);
//
//
//  fc32_BlockChain filter_chain = { 0 };
//  fc32_IBlock* blocks[] = {
//    &p1.block,
//    &p2.block,
//  };
//  filter_chain.blocks = &blocks[0];
//  filter_chain.block_count = fc_COUNTOF(blocks);
//  fc32_BlockChain_preload(&filter_chain, 0);
//
//
//  for (size_t i = 0; i < 50; i++)
//  {
//    int32_t input = i;
//    int32_t output = fc32_BlockChain_step(&filter_chain, input);
//    EXPECT_EQ(output, input);
//  }
//}
//
//
//TEST(BlockChain_i32, OneIirDynamicCalc) {
//
//  fc32_IirLowPass iir1;
//  fc32_IirLowPass_ctor(&iir1);
//  iir1.new_ratio = 0.3f;
//
//
//  fc32_BlockChain filter_chain = { 0 };
//  fc32_IBlock* blocks[] = {
//    &iir1.block,
//  };
//  filter_chain.blocks = &blocks[0];
//  filter_chain.block_count = fc_COUNTOF(blocks);
//  fc32_BlockChain_preload(&filter_chain, 0);
//
//  const int32_t input = 100;
//  const int32_t error_tol = 1;
//  int32_t expected;
//  int32_t output = 0;
//  int32_t difference;
//
//  for (size_t i = 0; i < 50; i++)
//  {
//    int32_t last_output = output;
//    difference = input - last_output;
//    expected = (int32_t)(difference * iir1.new_ratio) + last_output;
//    output = fc32_BlockChain_step(&filter_chain, input);
//    EXPECT_NEAR(expected, output, error_tol);
//  }
//}
//
//
//
//TEST(BlockChain_i32, DownSamplerPassthrough) {
//
//  fc32_PassThrough downsampled_p1;
//  fc32_PassThrough_ctor(&downsampled_p1);
//
//  fc32_DownSampler down_sampler;
//  fc32_DownSampler_ctor(&down_sampler);
//  down_sampler.sample_every_x = 2;  //downsample by 2
//  fc32_IBlock* downsampled_blocks[] = {
//    &downsampled_p1.block,
//  };
//  down_sampler.base_fc_instance.blocks = &downsampled_blocks[0];
//  down_sampler.base_fc_instance.block_count = fc_COUNTOF(downsampled_blocks);
//
//
//  fc32_BlockChain top_filter_chain = { 0 };
//  fc32_IBlock* top_filter_blocks[] = {
//    &down_sampler.base_fc_instance.block,
//  };
//  top_filter_chain.blocks = &top_filter_blocks[0];
//  top_filter_chain.block_count = fc_COUNTOF(top_filter_blocks);
//  fc32_BlockChain_preload(&top_filter_chain, 0);
//
//  const int32_t error_tolerance = 0;
//  const int32_t inputs[] =           {1,2,3,4,5,6,7,8,9,10};
//  const int32_t expected_outputs[] = {0,2,2,4,4,6,6,8,8,10};
//  const size_t length = fc_COUNTOF(expected_outputs);
//  test_chain_against_array(&top_filter_chain, inputs, expected_outputs, length, error_tolerance);
//}
//
//
//TEST(BlockChain_i32, DownSamplerIir) {
//
//  fc32_IirLowPass downsampled_iir;
//  fc32_IirLowPass_ctor(&downsampled_iir);
//  downsampled_iir.new_ratio = 0.5;
//
//  fc32_DownSampler down_sampler;
//  fc32_DownSampler_ctor(&down_sampler);
//  down_sampler.sample_every_x = 2;  //downsample by 2
//  fc32_IBlock* downsampled_blocks[] = {
//    &downsampled_iir.block,
//  };
//  down_sampler.base_fc_instance.blocks = &downsampled_blocks[0];
//  down_sampler.base_fc_instance.block_count = fc_COUNTOF(downsampled_blocks);
//
//
//  fc32_BlockChain top_filter_chain = { 0 };
//  fc32_IBlock* top_filter_blocks[] = {
//    &down_sampler.base_fc_instance.block,
//  };
//  top_filter_chain.blocks = &top_filter_blocks[0];
//  top_filter_chain.block_count = fc_COUNTOF(top_filter_blocks);
//  fc32_BlockChain_preload(&top_filter_chain, 0);
//
//  const int32_t error_tolerance = 0;
//  const int32_t inputs[] =           { 100, 100,100, 100,100, 100,100, 100,100, 100 };
//  //                       samples = { no,  yes,no,  yes,no,  yes,no,  yes,no,  yes,};
//  const int32_t expected_outputs[] = { 0,   50,50,   75,75,   88,88,   94,94,   97 };
//  const size_t length = fc_COUNTOF(expected_outputs);
//  test_chain_against_array(&top_filter_chain, inputs, expected_outputs, length, error_tolerance);
//}
//
//
//
//
//TEST(BlockChain_i32, MallocDownSamplerIir) {
//  MockHeap heap(&mockHeapPtr);
//  fc_BuildCtx* bc = &mbc;
//
//
//  fc32_BlockChain* filter_chain = fc32_BlockChain_new(bc,
//    LIST_START(32)
//    fc32_DownSampler_new_iblock(bc, 0, 2,
//      LIST_START(32)
//      fc32_IirLowPass_new_iblock(bc, 0.5),
//      LIST_END
//    ),
//    LIST_END
//  );
//
//  EXPECT_NE(filter_chain, fc_ALLOCATE_FAIL_PTR);
//  fc32_BlockChain_preload(filter_chain, 0);
//
//  const int32_t error_tolerance = 0;
//  const int32_t inputs[] = { 100, 100,100, 100,100, 100,100, 100,100, 100 };
//  //                       samples = { no,  yes,no,  yes,no,  yes,no,  yes,no,  yes,};
//  const int32_t expected_outputs[] = { 0,   50,50,   75,75,   88,88,   94,94,   97 };
//  const size_t length = fc_COUNTOF(expected_outputs);
//  test_chain_against_array(filter_chain, inputs, expected_outputs, length, error_tolerance);
//
//  fc32_BlockChain_destruct_entire(filter_chain);
//
//  ASSERT_EQ(heap.getAllocationCount(), 0);
//}
//
//
//
//TEST(BlockChain_i32, TestHeapMocking3) {
//  MockHeap heap(&mockHeapPtr);
//  fc_BuildCtx* bc = &mbc;
//
//  //see if we can NULL the 3rd returned malloc
//  EXPECT_CALL(heap, xMalloc(_)).Times(3)
//    .WillOnce(DoDefault())
//    .WillOnce(ReturnNull())
//    .WillOnce(DoDefault());
//  fc32_PassThrough* p1 = fc32_PassThrough_new(bc);
//  fc32_PassThrough* p2 = fc32_PassThrough_new(bc); //RETURN NULL HERE!
//  fc32_PassThrough* p3 = fc32_PassThrough_new(bc);
//
//  ASSERT_EQ(heap.getAllocationCount(), 2);
//
//  EXPECT_NE(p1, fc_ALLOCATE_FAIL_PTR); //NOT equal
//  EXPECT_EQ(p2, fc_ALLOCATE_FAIL_PTR);
//  EXPECT_NE(p3, fc_ALLOCATE_FAIL_PTR); //NOT equal
//}
//
//
//TEST(BlockChain_i32, MallocSimpleTest) {
//  MockHeap heap(&mockHeapPtr);
//  fc_BuildCtx* bc = &mbc;
//
//  fc32_PassThrough* p_filter;
//  int expected_size = sizeof(*p_filter);
//
//  EXPECT_CALL(heap, xMalloc(expected_size)).Times(1);
//  p_filter = fc32_PassThrough_new(bc);
//  ASSERT_EQ(heap.getAllocationCount(), 1);
//  Allocation allocation = heap.peakFirstAllocationOrThrow();
//  ASSERT_EQ(allocation.size, sizeof(*p_filter));
//}
//
//
//TEST(BlockChain_i32, MallocFailurePassThroughFilter) {
//  MockHeap heap(&mockHeapPtr);
//  fc_BuildCtx* bc = &mbc;
//
//  fc32_PassThrough* p_filter;
//  int expected_size = sizeof(*p_filter);
//
//  EXPECT_CALL(heap, xMalloc(_)).Times(1).WillOnce(Return(nullptr));
//  p_filter = fc32_PassThrough_new(bc);
//  EXPECT_EQ(fc_ALLOCATE_FAIL_PTR, p_filter);
//}
//
//
//
////TODO test all objects for malloc failure
//
//TEST(BlockChain_i32, MallocFailureInChain1) {
//  MockHeap heap(&mockHeapPtr);
//  fc_BuildCtx* bc = &mbc;
//
//  EXPECT_CALL(heap, xMalloc(_)).Times(AtLeast(3))
//    .WillOnce(DoDefault())  //0.42 IIR
//    .WillOnce(ReturnNull()) //0.41 IIR  //RETURN NULL
//    .WillRepeatedly(DoDefault()) //rest of filters
//    ;
//
//  EXPECT_CALL(heap, xFree(_)).Times(AtLeast(1));
//
//  fc32_IirLowPass* iir_ref;
//
//  fc32_BlockChain* filter_chain = fc32_BlockChain_new(bc,
//    LIST_START(32)
//    fc32_DownSampler_new_iblock(bc, 0, 2,
//      LIST_START(32)
//      (IBlock*)(iir_ref = fc32_IirLowPass_new(bc, 0.40f)),  //NOTE how to get a reference to a filter
//      fc32_IirLowPass_new_iblock(bc, 0.41f),
//      fc32_IirLowPass_new_iblock(bc, 0.42f),
//      LIST_END
//    ),
//    LIST_END
//  );
//
//  EXPECT_EQ(filter_chain, fc_ALLOCATE_FAIL_PTR);
//  EXPECT_EQ(heap.getAllocationCount(), 0);
//}
//
//
//
//TEST(BlockChain_i32, DetermineSizeWithoutAllocating) {
//  MockHeap heap(&mockHeapPtr);
//  fc_CountAllocator count_allocator;
//  fc_CountAllocator_ctor(&count_allocator, &fc_Mallocator);
//  fc_BuildCtx counting_bc;
//  counting_bc.allocator = &count_allocator.base_instance;
//
//  fc_BuildCtx* bc = &counting_bc;
//
//  EXPECT_CALL(heap, xMalloc(_)).WillRepeatedly(ReturnNull());
//
//  size_t expected_total_size = 0;
//  size_t inner_blocks_count = 0;
//
//  inner_blocks_count = 4;
//  expected_total_size += sizeof(fc32_BlockChain) + sizeof(fc32_DownSampler) + 3 * sizeof(fc32_IirLowPass);
//  expected_total_size += sizeof(void*) * inner_blocks_count;
//
//  fc32_BlockChain* filter_chain = fc32_BlockChain_new(bc,
//      LIST_START(32)
//      fc32_DownSampler_new_iblock(bc, 0, 2,
//          LIST_START(32)
//          fc32_IirLowPass_new_iblock(bc, 0.40f),
//          fc32_IirLowPass_new_iblock(bc, 0.41f),
//          fc32_IirLowPass_new_iblock(bc, 0.42f),
//          LIST_END
//      ),
//      LIST_END
//  );
//
//  EXPECT_EQ(count_allocator.requested_bytes, expected_total_size);
//  EXPECT_EQ(heap.getAllocationCount(), 0);
//}
//
//
//TEST(BlockChain_i32, DetermineSizeWhileAllocating) {
//  MockHeap heap(&mockHeapPtr);
//  fc_CountAllocator count_allocator;
//  fc_CountAllocator_ctor(&count_allocator, &fc_Mallocator);
//  fc_BuildCtx counting_bc;
//  counting_bc.allocator = &count_allocator.base_instance;
//
//  fc_BuildCtx* bc = &counting_bc;
//
//  EXPECT_CALL(heap, xMalloc(_)).Times(AtLeast(4));
//
//  size_t expected_total_size = 0;
//  size_t inner_blocks_count = 0;
//
//  inner_blocks_count = 4;
//  expected_total_size += sizeof(fc32_BlockChain) + sizeof(fc32_DownSampler) + 3 * sizeof(fc32_IirLowPass);
//  expected_total_size += sizeof(void*) * inner_blocks_count;
//
//  fc32_BlockChain* filter_chain = fc32_BlockChain_new(bc,
//    LIST_START(32)
//    fc32_DownSampler_new_iblock(bc, 0, 2,
//      LIST_START(32)
//      fc32_IirLowPass_new_iblock(bc, 0.40f),
//      fc32_IirLowPass_new_iblock(bc, 0.41f),
//      fc32_IirLowPass_new_iblock(bc, 0.42f),
//      LIST_END
//    ),
//    LIST_END
//  );
//
//  EXPECT_NE(filter_chain, fc_ALLOCATE_FAIL_PTR);
//
//  EXPECT_EQ(count_allocator.requested_bytes, expected_total_size);
//  EXPECT_EQ(heap.sumAllocationBytes(), expected_total_size);
//}
//





int main(int argc, char** argv) {
  ::testing::InitGoogleMock(&argc, argv);
  int result = RUN_ALL_TESTS();
  return result;
}