#include "TestCommon.hpp"
#include "all_types.h"
#include "fc_lib/fcflt_lib.h"
#include "BasicTests.hpp"


using testing::Types;


/**
* Define which primitive types will be used to test the IirAsymLowPass filter implementation.
*/
typedef Types<fc32_IirAsymLowPass, fc8_IirAsymLowPass, fcflt_IirAsymLowPass> TypesToTest;




//forward declare
template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestRiseOnly(ICtorGroup<BlockType>* ctorGroup);

template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestFallOnly(ICtorGroup<BlockType>* ctorGroup);


/**
* Define how the IirAsymLowPass constructors will be tested. See `ICtorGroup` for more detail.
*/
template <typename BlockType>
class IirAsymLowPassCtorGroup : public StoredFuncsCtorGroup<BlockType> {

public:
  using StoredFuncsCtorGroup::StoredFuncsCtorGroup; //to inherit parent constructors

  //expected value for objects constructed in this group
  float expected_raising_ratio;
  float expected_lowering_ratio;

  /**
   * Builds the function that will test ALL the fields in a constructed IirAsymLowPass block.
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    auto thisCtorGroup = this;
    return [=](BlockType* block) {
      //fc8_IirAsymLowPass* b;
      EXPECT_EQ(block->last_output, 0);
      EXPECT_EQ(block->lowering_ratio, expected_lowering_ratio);
      EXPECT_EQ(block->raising_ratio, expected_raising_ratio);
    };
  }

};






/**
* Provides methods that will allow the base `StandardBlockTester` class to
* test and validate the IirAsymLowPass filter block implementation.
*/
template <typename BlockType>
class IirAsymLowPassTester : public StoredStandardBlockTester<BlockType>
{
public:
  using PrimitiveType = PrimitiveType; //we inherit PrimitiveType, but this line helps intellisense


  virtual vector<ICtorGroup<BlockType>*> buildSimpleCtorGroups(void) override
  {
    vector<ICtorGroup<BlockType>*> groups;

    {
      const float raising_ratio = 0.5f;
      const float lowering_ratio = 0.0000000000001f;  //something non-zero so we can test for known field values
      auto ctorGroup = buildSimpleCtorsWithHigherLowerRatio(raising_ratio, lowering_ratio);
      ctorGroup->stepTestFuncs.push_back(getStepTestRiseOnly<BlockType, PrimitiveType>(ctorGroup));
      groups.push_back(ctorGroup);
    }

    {
      const float raising_ratio = 0.0000000000001f;  //something non-zero so we can test for known field values
      const float lowering_ratio = 0.5f; 
      auto ctorGroup = buildSimpleCtorsWithHigherLowerRatio(raising_ratio, lowering_ratio);
      ctorGroup->stepTestFuncs.push_back(getStepTestFallOnly<BlockType, PrimitiveType>(ctorGroup));
      groups.push_back(ctorGroup);
    }
    
    return groups;
  }


  /**
  * Defines "C++" wrapper functions that will utilize each and every "c" constructor function THAT allocates internally.
  * Why? Because we test every possible combination of allocation failure to ensure that every allocating
  * constructor function behaves as expected.
  */
  virtual vector<ICtorGroup<BlockType>*> buildMemGrindCtorGroups(void) override
  {
    const float raising_ratio = Randomization::get_for_type<float>();
    const float lowering_ratio = Randomization::get_for_type<float>();

    vector<ICtorGroup<BlockType>*> groups;

    auto ctorGroup = new IirAsymLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new<BlockType>(bc, raising_ratio, lowering_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new_iblock<BlockType>(bc, raising_ratio, lowering_ratio);
      },
    };

    ctorGroup->addNoCrashStepTestFunc();
    ctorGroup->expected_raising_ratio = raising_ratio;
    ctorGroup->expected_lowering_ratio  = lowering_ratio;

    groups.push_back(ctorGroup);

    return groups;
  }


private:
  IirAsymLowPassCtorGroup<BlockType>* buildSimpleCtorsWithHigherLowerRatio(float raising_ratio, float lowering_ratio)
  {
    auto ctorGroup = new IirAsymLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new<BlockType>(bc, raising_ratio, lowering_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new_iblock<BlockType>(bc, raising_ratio, lowering_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);

        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        block->raising_ratio = raising_ratio;
        block->lowering_ratio = lowering_ratio;
        return block;
      },
    };

    ctorGroup->expected_lowering_ratio = lowering_ratio;
    ctorGroup->expected_raising_ratio = raising_ratio;
    return ctorGroup;
  }

};





template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestRiseOnly(ICtorGroup<BlockType>* ctorGroup) {
  auto func_name = __func__;
  auto func = [=](BlockType* block) {
    SCOPED_TRACE(func_name);
    ASSERT_EQ(block->raising_ratio, 0.5f);
    ASSERT_NEAR(block->lowering_ratio, 0.0f, 0.00001f);
    const PrimitiveType init_value = 10;

    CppX_preload(block, init_value);

    vector<InputOutput<PrimitiveType>> steps = {
      InputOutput<PrimitiveType>{  4, 10 }, //input less than last output, so will stay
      InputOutput<PrimitiveType>{  9, 10 }, //input less than last output, so will stay
      InputOutput<PrimitiveType>{ 20, 15 }, //input > than last output, so it will rise 50% the difference
      InputOutput<PrimitiveType>{ 25, 20 }, //input > than last output, so it will rise 50% the difference
      InputOutput<PrimitiveType>{  0, 20 }, //input less than last output, so it will stay
      InputOutput<PrimitiveType>{ 30, 25 }, //input > than last output, so it will rise 50% the difference
    };

    TestCommon::test_steps(block, steps, 1);

  };//end of test function

  return func;
}


template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestFallOnly(ICtorGroup<BlockType>* ctorGroup) {
  auto func_name = __func__;
  auto func = [=](BlockType* block) {
    SCOPED_TRACE(func_name);
    ASSERT_NEAR(block->raising_ratio, 0.0f, 0.00001f);
    ASSERT_EQ(block->lowering_ratio, 0.5f);
    const PrimitiveType init_value = 50;

    CppX_preload(block, init_value);

    vector<InputOutput<PrimitiveType>> steps = {
      InputOutput<PrimitiveType>{ 88, 50 }, //input above last output, so will stay
      InputOutput<PrimitiveType>{ 55, 50 }, //input above last output, so will stay
      InputOutput<PrimitiveType>{ 40, 45 }, //input < than last output, so it will drop 50% the difference
      InputOutput<PrimitiveType>{ 35, 40 }, //input < than last output, so it will drop 50% the difference
      InputOutput<PrimitiveType>{ 30, 35 }, //input < than last output, so it will drop 50% the difference
      InputOutput<PrimitiveType>{ 77, 35 }, //input above last output, so will stay
    };

    TestCommon::test_steps(block, steps, 1);

  };//end of test function

  return func;
}





//The following define which tester to use for particular types.
template <> void* get_tester<fc8_IirAsymLowPass>(void) { return new IirAsymLowPassTester<fc8_IirAsymLowPass>; }
template <> void* get_tester<fc32_IirAsymLowPass>(void) { return new IirAsymLowPassTester<fc32_IirAsymLowPass>; }
template <> void* get_tester<fcflt_IirAsymLowPass>(void) { return new IirAsymLowPassTester<fcflt_IirAsymLowPass>; }




/**
* Instantiate
*/
#undef IirAsymLowPass
INSTANTIATE_TYPED_TEST_CASE_P(IirAsymLowPass, IBlockTests, TypesToTest);





TEST(fc32_IirAsymLowPass, _step_0_coefficients)
{
  TestCommon::runWithBuildCtx( [](fc_BuildCtx* bc) {
    const int32_t init_value = 6468;
    fc32_IirAsymLowPass* p1 = fc32_IirAsymLowPass_new(bc, 0, 0);
    fc32_IirAsymLowPass_preload(p1, init_value);
    vector<int32_t> inputs = { 235, 5325, 57575, 455 };
    vector<int32_t> outputs = { init_value };
    //TestCommon::xtest_block(p1, inputs, outputs);
  });
}
