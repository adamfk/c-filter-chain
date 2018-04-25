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



/**
* Define how the IirAsymLowPass constructors will be tested. See `ICtorGroup` for more detail.
*/
template <typename BlockType>
class IirAsymLowPassCtorGroup : public StoredFuncsCtorGroup<BlockType> {

public:
  using StoredFuncsCtorGroup::StoredFuncsCtorGroup; //to inherit parent constructors

  //expected value for objects constructed in this group
  float expected_higher_ratio;
  float expected_lower_ratio;

  /**
   * Builds the function that will test ALL the fields in a constructed IirAsymLowPass block.
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    auto thisCtorGroup = this;
    return [=](BlockType* block) {
      //fc8_IirAsymLowPass* b;
      EXPECT_EQ(block->last_output, 0);
      EXPECT_EQ(block->lower_ratio, expected_lower_ratio);
      EXPECT_EQ(block->higher_ratio, expected_higher_ratio);
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


  virtual ICtorGroup<BlockType>* buildSimpleCtors(void) override
  {
    const float higher_ratio = 0.5f;
    const float lower_ratio = 0.0f;
    auto ctorGroup = buildSimpleCtorsWithHigherLowerRatio(higher_ratio, lower_ratio);
    ctorGroup->stepTestFuncs.push_back(getStepTestRiseOnly<BlockType, PrimitiveType>(ctorGroup));
    return ctorGroup;
  }


  /**
  * Defines "C++" wrapper functions that will utilize each and every "c" constructor function THAT allocates internally.
  * Why? Because we test every possible combination of allocation failure to ensure that every allocating
  * constructor function behaves as expected.
  */
  virtual IirAsymLowPassCtorGroup<BlockType>* buildMemGrindCtors(void) override
  {
    const float higher_ratio = Randomization::get_for_type<float>();
    const float lower_ratio = Randomization::get_for_type<float>();

    auto ctorGroup = new IirAsymLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new<BlockType>(bc, higher_ratio, lower_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new_iblock<BlockType>(bc, higher_ratio, lower_ratio);
      },
    };

    ctorGroup->addNoCrashStepTestFunc();
    ctorGroup->expected_higher_ratio = higher_ratio;
    ctorGroup->expected_lower_ratio  = lower_ratio;

    return ctorGroup;
  }


private:
  IirAsymLowPassCtorGroup<BlockType>* buildSimpleCtorsWithHigherLowerRatio(float higher_ratio, float lower_ratio)
  {
    auto ctorGroup = new IirAsymLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new<BlockType>(bc, higher_ratio, lower_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAsymLowPass_new_iblock<BlockType>(bc, 0, 0);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);

        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        //block->new_ratio = new_ratio; 
        //FIXME
        return block;
      },
    };

    ctorGroup->expected_lower_ratio = lower_ratio;
    ctorGroup->expected_higher_ratio = higher_ratio;
    return ctorGroup;
  }

};





template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestRiseOnly(ICtorGroup<BlockType>* ctorGroup) {
  auto func = [=](BlockType* block) {
    ASSERT_EQ(block->higher_ratio, 0.5f);
    ASSERT_EQ(block->lower_ratio, 0.0f);
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




TEST(fc32_IirAsymLowPass, _new_step_fall_only) {
  TestCommon::runWithBuildCtx([](fc_BuildCtx* mb) {
    const int32_t init_value = 50;
    fc32_IirAsymLowPass* p1 = fc32_IirAsymLowPass_new(mb, 0, 0.5f);
    fc32_IirAsymLowPass_preload(p1, init_value);

    vector<InputOutput<int32_t>> steps = {
      InputOutput<int32_t>{ 88, 50 }, //input above last output, so will stay
      InputOutput<int32_t>{ 55, 50 }, //input above last output, so will stay
      InputOutput<int32_t>{ 40, 45 }, //input < than last output, so it will drop 50% the difference
      InputOutput<int32_t>{ 35, 40 }, //input < than last output, so it will drop 50% the difference
      InputOutput<int32_t>{ 30, 35 }, //input < than last output, so it will drop 50% the difference
      InputOutput<int32_t>{ 77, 35 }, //input above last output, so will stay
    };

    TestCommon::test_steps(p1, steps);
  });
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
  TestCommon::runWithBuildCtx( [](fc_BuildCtx* mb) {
    const int32_t init_value = 6468;
    fc32_IirAsymLowPass* p1 = fc32_IirAsymLowPass_new(mb, 0, 0);
    fc32_IirAsymLowPass_preload(p1, init_value);
    vector<int32_t> inputs = { 235, 5325, 57575, 455 };
    vector<int32_t> outputs = { init_value };
    //TestCommon::xtest_block(p1, inputs, outputs);
  });
}
