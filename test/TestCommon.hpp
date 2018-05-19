#pragma once

//gmock is different than other Unit Testing frameworks.
//see https://github.com/google/googletest/blob/master/googlemock/docs/ForDummies.md 
// in particular see https://github.com/google/googletest/blob/master/googlemock/docs/ForDummies.md#all-expectations-are-sticky-unless-said-otherwise

#include <stdio.h>
#include <stdlib.h>
#include <vector>
#include <functional>

#include <cstdlib>
#include <math.h>

#include "gmock/gmock.h"
#include "gtest/gtest.h"

#include "fc_lib/fc_common.h"
#include "fc_default_config.h"

#include "fc_lib/fc_allocate.h"
#include "fc_lib/fc_Mallocator.h"
#include "fc_lib/fc_CountAllocator.h"

#include "MockHeap.hpp"
#include "visitors.hpp"
#include "all_types.h"
#include "MetaNewx.hpp"

#include "NotABlock.h"
#include "numeric_utils.hpp"
#include "randomization.hpp"


using std::vector;
using ::testing::_;
using ::testing::Invoke;
using ::testing::Return;
using ::testing::ReturnNull;
using ::testing::DoDefault;
using ::testing::AtLeast;
using ::testing::InSequence;


#define RETURN_IF_FATAL_FAILURE()      if (::testing::Test::HasFatalFailure()) { return; }
#define RETURN_IF_ANY_FAILURE()      if (::testing::Test::HasFailure()) { return; }



//should ONLY be used directly after constructing a block from a ICtorGroup
//to improve tracing to the lambda constructor source.
//No need to call in step/field test functions as their asserts/expects will capture stack
//trace information properly.
//modified from `SCOPED_TRACE()`
#define SCOPED_TRACE_CTOR_GROUP(ctorGroupPtr) \
  ::testing::internal::ScopedTrace GTEST_CONCAT_TOKEN_(gtest_trace_, __LINE__)(\
  (ctorGroupPtr)->getLocationFilePath(), \
  (ctorGroupPtr)->getLocationLineNumber(), \
  ::testing::Message() << "ctor source")


//TODO test allocation of working buffer

extern fc_BuildCtx test_malloc_builder;

typedef std::function<void*(fc_BuildCtx*)> new_iblock_func_t;

template <typename PrimitiveType> class InputOutput {
public:
  PrimitiveType input;
  PrimitiveType expected_output;
};


/**
 * Wraps up a few common things used all over for setting up tests
 */
class MockHeapBuilder : public MockHeap {
  fc_BuildCtx builder = { 0 };
  

public:
  fc_WorkingBuffer wb = { 0 };
  fc_BuildCtx* bc;
  bool self_allocated_wb_buffer = false;

  MockHeapBuilder(MockHeap** c_reference) : MockHeap(c_reference) {
    builder.allocator = &fc_Mallocator;
    builder.working_buffer = &wb;
    bc = &builder;
  }

  void setAllocator(fc_IAllocator* allocator) {
    builder.allocator = allocator;
  }

  void allocateWorkingBuffer(void) {
    self_allocated_wb_buffer = true;
    wb.buffer = malloc(builder.min_working_buffer_size);

    if (wb.buffer != nullptr) {
      wb.size = builder.min_working_buffer_size;
    }
  }

  operator fc_BuildCtx* () { return bc; };
  operator fc_IAllocator const * () { return bc->allocator; };

  virtual ~MockHeapBuilder() {
    if (self_allocated_wb_buffer) {
      free(wb.buffer);
    }
  }
};



class TestCommon 
{
private:


  template <typename PrimitiveType> static PrimitiveType get_expected(vector<PrimitiveType> expected_outputs, size_t index)
  {
    SCOPED_TRACE(__func__);

    PrimitiveType result;
    if (index >= expected_outputs.size()) {
      result = expected_outputs.back();
    } else {
      result = expected_outputs[index];
    }
    return result;
  }



public:

  static void test_iblock_constructed(void* iblock);


  template <typename BlockType, typename PrimitiveType> static void test_steps(BlockType* block, vector<InputOutput<PrimitiveType>> steps, double error_tolerance = 0)
  {
    SCOPED_TRACE(__func__);
    using BlockPrimitiveType = FilterPrimitiveTypeSelector<BlockType>::type;
    static_assert(std::is_same<BlockPrimitiveType, PrimitiveType>(), "Input/Block primitive types mismatch!");

    PrimitiveType actual_output;

    auto testCount = steps.size();

    for (size_t i = 0; i < testCount; i++) {
      InputOutput<PrimitiveType> step = steps[i];
      actual_output = CppX_step(block, step.input);
      SCOPED_TRACE(std::string("step ") + std::to_string(i+1) + "/" + std::to_string(testCount));
      EXPECT_NEAR(step.expected_output, actual_output, error_tolerance);
      RETURN_IF_FATAL_FAILURE();
    }
  }

  

  template <typename BlockType, typename PrimitiveType> static void test_steps_repeatedly(BlockType* block, vector<InputOutput<PrimitiveType>> steps, size_t loopCount, double error_tolerance = 0)
  {
    for (size_t i = 0; i < loopCount; i++) {
      SCOPED_TRACE(std::string("loop step ") + std::to_string(i + 1) + "/" + std::to_string(loopCount));
      test_steps(block, steps, error_tolerance);
      RETURN_IF_FATAL_FAILURE();
    }
  }


  /**
   * Do this when you want to ensure that it doesn't explode, but can't describe what output should look like
   */
  template <typename BlockType> static void preload_step_random_no_expect(BlockType* block, size_t times)
  {
    SCOPED_TRACE(__func__);
    using PrimitiveType = FilterPrimitiveTypeSelector<BlockType>::type;

    PrimitiveType input = Randomization::get_for_type<PrimitiveType>();
    CppX_preload(block, input);

    for (size_t i = 0; i < times; i++) {
      input = Randomization::get_for_type<PrimitiveType>();
      CppX_step(block, input);
    }
  }

  /**
   * @expected_outputs vector can be shorter than inputs. It will just keep using the last value.
   */
  template <typename BlockType, typename PrimitiveType> 
  static void xtest_block(BlockType* block, vector<PrimitiveType> inputs, vector<PrimitiveType> expected_outputs, double error_tolerance = 0)
  {
    SCOPED_TRACE(__func__);
    using BlockPrimitiveType = FilterPrimitiveTypeSelector<BlockType>::type;
    static_assert(std::is_same<BlockPrimitiveType, PrimitiveType>(), "Input/Block primitive types mismatch!");

    PrimitiveType input;
    PrimitiveType expected;
    PrimitiveType actual_output;
    char msg[100];

    for (size_t i = 0; i < inputs.size(); i++) {
      snprintf(msg, fc_COUNTOF(msg), "At Step %i/%i", i+1, inputs.size());
      SCOPED_TRACE(msg);
      input = inputs[i];
      expected = get_expected(expected_outputs, i);
      actual_output = CppX_step(block, input);

      if (::testing::Test::HasFailure()) {
        return;
      }

      EXPECT_NEAR(expected, actual_output, error_tolerance);
    }
  }
  

  template <typename BlockType>
  static void test_simple_visitor(vector<ICtorGroup<BlockType>*> ctorGroups)
  {
    SCOPED_TRACE(__func__);

    for (size_t ctorGroupIndex = 0; ctorGroupIndex < ctorGroups.size(); ctorGroupIndex++)
    {
      SCOPED_TRACE(std::string("ctor group index: ") + std::to_string(ctorGroupIndex));
      auto ctorGroup = ctorGroups[ctorGroupIndex];

      for each (auto ctor in ctorGroup->getCtors())
      {
        build_run<BlockType>(ctorGroup, ctor, [=](BlockType* block) {
          MockVisitor visitor;
          InSequence dummy;
          EXPECT_CALL(visitor, block_entered(block)).Times(1);
          EXPECT_CALL(visitor, block_exited(block)).Times(1);
          fc_run_visitor(visitor, block);
        });
      }
    }
  }




  template <typename BlockType>
  static void build_test_destruct2_part(ICtorGroup<BlockType>* ctorGroup, 
                                        Ctor<BlockType> ctor,
                                        StepFunc<BlockType>* stepTestFunc) 
  {
    MockHeapBuilder hb(&mockHeapPtr);

    auto blockFieldsTestFunc = ctorGroup->getBlockFieldsTestFunc();

    int expected_allocations = ctorGroup->getExpectedAllocCount();
    int expected_inner_allocations = expected_allocations - 1;
    size_t expected_alloc_sum = ctorGroup->getExpectedAllocSum();

    ASSERT_GE(expected_allocations, 1); //must expect allocate at least once
    EXPECT_CALL(hb, xMalloc(_)).Times(expected_allocations);

    BlockType* block = ctor(hb);
    SCOPED_TRACE_CTOR_GROUP(ctorGroup); //comes after call because call sets the info

    test_iblock_constructed(block);
    RETURN_IF_FATAL_FAILURE();

    hb.allocateWorkingBuffer();
    EXPECT_EQ(hb.sumAllocationBytes(), expected_alloc_sum);

    {
      SCOPED_TRACE("test block fields");
      blockFieldsTestFunc(block);
      RETURN_IF_FATAL_FAILURE();
    }

    {
      SCOPED_TRACE("step test");
      (*stepTestFunc)(block);
      RETURN_IF_FATAL_FAILURE();
    }


    EXPECT_CALL(hb, xFree(_)).Times(expected_inner_allocations).RetiresOnSaturation();
    EXPECT_CALL(hb, xFree(block)).Times(1).RetiresOnSaturation();
    fc_destruct_and_free(block, hb);

    EXPECT_EQ(hb.getAllocationCount(), 0);
  }




  template <typename BlockType>
  static void build_test_destruct2(vector<ICtorGroup<BlockType>*> ctorGroups) {
    SCOPED_TRACE(__func__);

    for (size_t ctorGroupIndex = 0; ctorGroupIndex < ctorGroups.size(); ctorGroupIndex++)
    {
      SCOPED_TRACE(std::string("ctor group index: ") + std::to_string(ctorGroupIndex));
      auto ctorGroup = ctorGroups[ctorGroupIndex];

      auto stepTestFuncs = ctorGroup->getStepTestFuncs();

      ASSERT_GE(stepTestFuncs.size(), 1);

      int ctor_index = 1;
      for each (auto ctor in ctorGroup->getCtors())
      {
        for each (auto stepTestFunc in stepTestFuncs)
        {
          SCOPED_TRACE("ctor index: " + std::to_string(ctor_index));
          build_test_destruct2_part(ctorGroup, ctor, &stepTestFunc);
          RETURN_IF_FATAL_FAILURE();
          ctor_index++;
        }
      }
    }
  }



  //TODO organize in file
  template <typename BlockType>
  struct alloc_free_step_args_t
  {
    ICtorGroup<BlockType>* ctorGroup;
    Ctor<BlockType> ctor;
    std::function<void(BlockType*)> blockFieldsTestFunc;
    StepFunc<BlockType>* stepTestFunc;
    size_t expected_allocations;
    size_t expected_alloc_sum;
    size_t alloc_permutation_i;
    size_t alloc_permutation_n;
  };




  template <typename BlockType>
  static void test_alloc_free_step(alloc_free_step_args_t<BlockType>* args) {
    SCOPED_TRACE(__func__);

    MockHeapBuilder hb(&mockHeapPtr);
    fc_CountAllocator count_allocator;
    fc_CountAllocator_ctor(&count_allocator, &fc_Mallocator);
    hb.setAllocator(&count_allocator.base_instance);

    char msg[200];
    char alloc_status_chars[100]; //string of chars for indicating mock heap return value

    fc_ZERO_STRUCT(alloc_status_chars);

    bool should_fail = false;

    //setup mock heap return success/failure sequence for this alloc_permutation_i
    {
      InSequence dummy;
      ASSERT_LT(args->expected_allocations, fc_COUNTOF(alloc_status_chars));

      for (size_t alloc_index = 0; alloc_index < args->expected_allocations; alloc_index++)
      {
        bool should_fail_alloc_x = (args->alloc_permutation_i & (1 << alloc_index) ) > 0;

        if (should_fail_alloc_x) {
          should_fail = true;
          alloc_status_chars[alloc_index] = 'F';
          EXPECT_CALL(hb, xMalloc(_)).Times(1).WillOnce(ReturnNull()).RetiresOnSaturation();
        }
        else {
          alloc_status_chars[alloc_index] = 'p';
          EXPECT_CALL(hb, xMalloc(_)).Times(1).WillOnce(DoDefault()).RetiresOnSaturation();
        }
      }
    }

    //%zu is for size_t
    snprintf(msg, fc_COUNTOF(msg), "Loop %zu/%zu. Mock heap returning: '%s'", args->alloc_permutation_i, args->alloc_permutation_n, alloc_status_chars);
    SCOPED_TRACE(msg);

    BlockType* block = args->ctor(hb);
    SCOPED_TRACE_CTOR_GROUP(args->ctorGroup); //comes after call because call sets the info

    EXPECT_EQ(args->expected_alloc_sum, count_allocator.requested_bytes);

    if (should_fail) {
      ASSERT_TRUE(is_bad_ptr(block));
      EXPECT_EQ(hb.sumAllocationBytes(), 0); //it should have freed all memory
      EXPECT_TRUE(hb.bc->one_or_more_failures);
    }
    else {
      EXPECT_EQ(hb.sumAllocationBytes(), args->expected_alloc_sum);

      test_iblock_constructed(block);
      SCOPED_TRACE_CTOR_GROUP(args->ctorGroup); //comes after call because call sets the info
      RETURN_IF_FATAL_FAILURE();

      {
        SCOPED_TRACE("test block fields");
        args->blockFieldsTestFunc(block);
        RETURN_IF_FATAL_FAILURE();
      }

      {
        SCOPED_TRACE("step test");
        (*args->stepTestFunc)(block);
        RETURN_IF_FATAL_FAILURE();
      }

      EXPECT_CALL(hb, xFree(_)).Times(args->expected_allocations);
      fc_destruct_and_free(block, hb);

      EXPECT_FALSE(hb.bc->one_or_more_failures);
    }

    EXPECT_EQ(hb.getAllocationCount(), 0);
  }




  template <typename BlockType>
  static void build_verify_alloc_free_part(ICtorGroup<BlockType>* ctorGroup,
                                        Ctor<BlockType> ctor,
                                        StepFunc<BlockType>* stepTestFunc)
  {
    SCOPED_TRACE(__func__);

    alloc_free_step_args_t<BlockType> args = { 0 };

    //TODOLOW audit below code to ensure safe for different primitive sizes

    args.ctor = ctor;
    args.ctorGroup = ctorGroup;
    args.stepTestFunc = stepTestFunc;
    args.blockFieldsTestFunc = ctorGroup->getBlockFieldsTestFunc();

    int expected_allocations = ctorGroup->getExpectedAllocCount();
    ASSERT_GE(expected_allocations, 1); //must expect allocate at least once

    args.expected_allocations = TryConvertToFrom<size_t>(expected_allocations);
    args.expected_alloc_sum = ctorGroup->getExpectedAllocSum();

    //loops = 2^allocs; so we can test every single alloc pass/fail permutation
    double temp_double = pow(2, expected_allocations);
    args.alloc_permutation_n = TryConvertToFrom<size_t>(temp_double);

    for (size_t i = 0; i < args.alloc_permutation_n; i++) {
      args.alloc_permutation_i = i;
      test_alloc_free_step(&args);
    }

  }




  template <typename BlockType>
  static void build_verify_alloc_free(vector<ICtorGroup<BlockType>*> ctorGroups) {
    SCOPED_TRACE(__func__);

    for (size_t ctorGroupIndex = 0; ctorGroupIndex < ctorGroups.size(); ctorGroupIndex++)
    {
      SCOPED_TRACE(std::string("ctor group index: ") + std::to_string(ctorGroupIndex));
      auto ctorGroup = ctorGroups[ctorGroupIndex];

      auto stepTestFuncs = ctorGroup->getStepTestFuncs();
      ASSERT_GE(stepTestFuncs.size(), 1);

      int ctorIndex = 0;
      for each (auto ctor in ctorGroup->getCtors())
      {
        SCOPED_TRACE(std::string("ctor index: ") + std::to_string(ctorIndex));

        for each (auto stepTestFunc in stepTestFuncs)
        {
          build_verify_alloc_free_part(ctorGroup, ctor, &stepTestFunc);
          RETURN_IF_ANY_FAILURE();
        }

        ctorIndex++;
      }
    }



  }




  template <typename BlockType>
  static void build_run(ICtorGroup<BlockType>* ctorGroup, Ctor<BlockType> ctor, std::function<void(BlockType* block)> run) {
    SCOPED_TRACE(__func__);

    MockHeapBuilder hb(&mockHeapPtr);

    BlockType* block = ctor(hb);
    SCOPED_TRACE_CTOR_GROUP(ctorGroup); //comes after call because call sets the info

    test_iblock_constructed(block);
    RETURN_IF_FATAL_FAILURE();

    run(block);
  }




  template <typename BlockType>
  static void test_type_testing(vector<ICtorGroup<BlockType>*> ctorGroups, std::function<bool(void* iblock)> comparison_func) 
  {
    SCOPED_TRACE(__func__);

    for (size_t ctorGroupIndex = 0; ctorGroupIndex < ctorGroups.size(); ctorGroupIndex++)
    {
      SCOPED_TRACE(std::string("ctor group index: ") + std::to_string(ctorGroupIndex));
      auto ctorGroup = ctorGroups[ctorGroupIndex];

      for each (auto ctor in ctorGroup->getCtors())
      {
        build_run<BlockType>(ctorGroup, ctor, [=](BlockType* block) {
          NotABlock not_a_block;
          NotABlock_ctor(&not_a_block);
          test_iblock_constructed(&not_a_block);
          RETURN_IF_FATAL_FAILURE();

          EXPECT_FALSE(comparison_func(&not_a_block));
          EXPECT_TRUE(comparison_func(block));
        });
      }
    }
  }




  /**
   * Use this to limit unnecessary MockHeap, fc_BuildCtx... setup boiler plate
   */
  static void runWithBuildCtx(std::function<void(fc_BuildCtx*)> runFunc) {
    SCOPED_TRACE(__func__);

    MockHeapBuilder hb(&mockHeapPtr);
    runFunc(hb);
  }



};



