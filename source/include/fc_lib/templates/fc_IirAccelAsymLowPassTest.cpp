#include "TestCommon.hpp"
#include "all_types.h"
#include "fc_lib/fcflt_lib.h"
#include "BasicTests.hpp"


using testing::Types;


/**
* Define which primitive types will be used to test the IirAccelAsymLowPass filter implementation.
*/
typedef Types<fc32_IirAccelAsymLowPass, fc8_IirAccelAsymLowPass, fcflt_IirAccelAsymLowPass> TypesToTest;




//forward declare
template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestRiseFaster(ICtorGroup<BlockType>* ctorGroup);

template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestLowerFaster(ICtorGroup<BlockType>* ctorGroup);


/**
* Define how the IirAccelAsymLowPass constructors will be tested. See `ICtorGroup` for more detail.
*/
template <typename BlockType>
class IirAccelAsymLowPassCtorGroup : public StoredFuncsCtorGroup<BlockType> {

public:
  using StoredFuncsCtorGroup::StoredFuncsCtorGroup; //to inherit parent constructors

  //expected values for objects constructed in this group
  bool rise_faster;
  float fast_ratio;
  float slow_ratio;
  float slow_ratio_inc_percent;
  float slow_ratio_dec_percent;

  /**
   * Builds the function that will test ALL the fields in a constructed IirAccelAsymLowPass block.
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    auto thisCtorGroup = this;
    return [=](BlockType* block) {
      //fc8_IirAccelAsymLowPass* b;
      BlockType* b = block;
      EXPECT_EQ(b->rise_faster, rise_faster);
      EXPECT_EQ(b->fast_ratio, fast_ratio);
      EXPECT_EQ(b->slow_ratio, slow_ratio);
      EXPECT_EQ(b->accelerated_slow_ratio, 0);
      EXPECT_EQ(b->slow_ratio_inc_percent, slow_ratio_inc_percent);
      EXPECT_EQ(b->slow_ratio_dec_percent, slow_ratio_dec_percent);
      EXPECT_EQ(b->last_output, 0);
    };
  }

};






/**
* Provides methods that will allow the base `StandardBlockTester` class to
* test and validate the IirAccelAsymLowPass filter block implementation.
*/
template <typename BlockType>
class IirAccelAsymLowPassTester : public StoredStandardBlockTester<BlockType>
{
public:
  using PrimitiveType = PrimitiveType; //we inherit PrimitiveType, but this line helps intellisense


  virtual vector<ICtorGroup<BlockType>*> buildSimpleCtorGroups(void) override
  {
    vector<ICtorGroup<BlockType>*> groups;

    {
      const bool rise_faster = true;
      const float fast_ratio = 1;
      const float slow_ratio = 0.1f;
      const float slow_ratio_inc_percent = 0.1f;
      const float slow_ratio_dec_percent = 0.2f;
      auto ctorGroup = buildSimpleCtorGroup(rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
      ctorGroup->stepTestFuncs.push_back(getStepTestRiseFaster<BlockType, PrimitiveType>(ctorGroup));
      groups.push_back(ctorGroup);
    }
    {
      const bool rise_faster = false;
      const float fast_ratio = 1;
      const float slow_ratio = 0.1f;
      const float slow_ratio_inc_percent = 0.1f;
      const float slow_ratio_dec_percent = 0.2f;
      auto ctorGroup = buildSimpleCtorGroup(rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
      ctorGroup->stepTestFuncs.push_back(getStepTestLowerFaster<BlockType, PrimitiveType>(ctorGroup));
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
    const bool rise_faster = Randomization::get_for_type<bool>();
    const float fast_ratio = Randomization::get_for_type<float>();
    const float slow_ratio = Randomization::get_for_type<float>();
    const float slow_ratio_inc_percent = Randomization::get_for_type<float>();
    const float slow_ratio_dec_percent = Randomization::get_for_type<float>();

    vector<ICtorGroup<BlockType>*> groups;

    auto ctorGroup = new IirAccelAsymLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
      sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAccelAsymLowPass_new<BlockType>(bc, rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAccelAsymLowPass_new_iblock<BlockType>(bc, rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
      },
    };

    ctorGroup->addNoCrashStepTestFunc();

    ctorGroup->rise_faster = rise_faster;
    ctorGroup->fast_ratio = fast_ratio;
    ctorGroup->slow_ratio = slow_ratio;
    ctorGroup->slow_ratio_inc_percent = slow_ratio_inc_percent;
    ctorGroup->slow_ratio_dec_percent = slow_ratio_dec_percent;

    groups.push_back(ctorGroup);

    return groups;
  }


private:
  IirAccelAsymLowPassCtorGroup<BlockType>* buildSimpleCtorGroup(bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent)
  {
    auto ctorGroup = new IirAccelAsymLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAccelAsymLowPass_new<BlockType>(bc, rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirAccelAsymLowPass_new_iblock<BlockType>(bc, rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);

        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        //fc8_IirAccelAsymLowPass* block; //uncomment when you want code completion
        CppX_ctor(block);
        block->rise_faster = rise_faster;
        block->fast_ratio = fast_ratio;
        block->slow_ratio = slow_ratio;
        block->slow_ratio_inc_percent = slow_ratio_inc_percent;
        block->slow_ratio_dec_percent = slow_ratio_dec_percent;
        return block;
      },
    };

    ctorGroup->rise_faster = rise_faster;
    ctorGroup->fast_ratio = fast_ratio;
    ctorGroup->slow_ratio = slow_ratio;
    ctorGroup->slow_ratio_inc_percent = slow_ratio_inc_percent;
    ctorGroup->slow_ratio_dec_percent = slow_ratio_dec_percent;

    return ctorGroup;
  }

};





template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestRiseFaster(ICtorGroup<BlockType>* ctorGroup) {
  auto func_name = __func__;
  auto func = [=](BlockType* block) {
    BlockType* b = block;
    //fc8_IirAccelAsymLowPass* b; //uncomment when you want code completion

    const double errorTolerance = 1;
    const size_t loopCount = 1;

    SCOPED_TRACE(func_name);
    ASSERT_EQ(b->rise_faster, true);
    ASSERT_NEAR(b->fast_ratio, 1.0, 0.00001);
    ASSERT_NEAR(b->slow_ratio, 0.1, 0.00001);

    CppX_preload(block, 0);

    //TODO test de-acceleration as well
    vector<InputOutput<PrimitiveType>> steps = {
      InputOutput<PrimitiveType>{   0,   0 },
      InputOutput<PrimitiveType>{   0,   0 },
      InputOutput<PrimitiveType>{   3,   3 },
      InputOutput<PrimitiveType>{   5,   5 },
      InputOutput<PrimitiveType>{ 100, 100 },  //step #5
      InputOutput<PrimitiveType>{   0,  90 },  //step #6
      InputOutput<PrimitiveType>{   0,  80 },  //step #7
      InputOutput<PrimitiveType>{   0,  70 },  //step #8
      InputOutput<PrimitiveType>{   0,  61 },  //step #9
      InputOutput<PrimitiveType>{   0,  52 },  //step #10
      InputOutput<PrimitiveType>{   0,  44 },  //step #11
      InputOutput<PrimitiveType>{   0,  36 },  //step #12
      InputOutput<PrimitiveType>{   0,  29 },  //step #13
      InputOutput<PrimitiveType>{   0,  23 },  //step #14
      InputOutput<PrimitiveType>{   0,  18 },  //step #15
      InputOutput<PrimitiveType>{   0,  13 },  //step #16
      InputOutput<PrimitiveType>{   0,   9 },  //step #17
      InputOutput<PrimitiveType>{   0,   6 },  //step #18
      InputOutput<PrimitiveType>{   0,   4 },  //step #19
      InputOutput<PrimitiveType>{   0,   2 },  //step #20
      InputOutput<PrimitiveType>{   0,   1 },  //step #21
      InputOutput<PrimitiveType>{   0,   1 },  //step #22
      InputOutput<PrimitiveType>{   0,   0 },  //step #23
      InputOutput<PrimitiveType>{   0,   0 },  //step #24
      InputOutput<PrimitiveType>{   0,   0 },  //step #25
      InputOutput<PrimitiveType>{   0,   0 },  //step #26
    };

    TestCommon::test_steps_repeatedly(block, steps, loopCount, errorTolerance);

  };//end of test function

  return func;
}





template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> getStepTestLowerFaster(ICtorGroup<BlockType>* ctorGroup) {
  auto func_name = __func__;
  auto func = [=](BlockType* block) {
    BlockType* b = block;
    //fc8_IirAccelAsymLowPass* b; //uncomment when you want code completion

    const double errorTolerance = 1;
    const size_t loopCount = 1;

    SCOPED_TRACE(func_name);
    ASSERT_EQ(b->rise_faster, false);
    ASSERT_NEAR(b->fast_ratio, 1.0, 0.00001);
    ASSERT_NEAR(b->slow_ratio, 0.1, 0.00001);

    CppX_preload(block, 100);

    //TODO test de-acceleration as well
    vector<InputOutput<PrimitiveType>> steps = {
      InputOutput<PrimitiveType>{ 100, 100 },
      InputOutput<PrimitiveType>{ 100, 100 },
      InputOutput<PrimitiveType>{  57,  57 },
      InputOutput<PrimitiveType>{  13,  13 },
      InputOutput<PrimitiveType>{  10,  10 },  //step #5
      InputOutput<PrimitiveType>{ 100,  19 },  //step #6
      InputOutput<PrimitiveType>{ 100,  28 },  //step #7
      InputOutput<PrimitiveType>{ 100,  37 },  //step #8
      InputOutput<PrimitiveType>{ 100,  45 },  //step #9
      InputOutput<PrimitiveType>{ 100,  53 },  //step #10
      InputOutput<PrimitiveType>{ 100,  61 },  //step #11
      InputOutput<PrimitiveType>{ 100,  68 },  //step #12
      InputOutput<PrimitiveType>{ 100,  74 },  //step #13
      InputOutput<PrimitiveType>{ 100,  80 },  //step #14
      InputOutput<PrimitiveType>{ 100,  85 },  //step #15
      InputOutput<PrimitiveType>{ 100,  89 },  //step #16
      InputOutput<PrimitiveType>{ 100,  92 },  //step #17
      InputOutput<PrimitiveType>{ 100,  95 },  //step #18
      InputOutput<PrimitiveType>{ 100,  97 },  //step #19
      InputOutput<PrimitiveType>{ 100,  98 },  //step #20
      InputOutput<PrimitiveType>{ 100,  99 },  //step #21
      InputOutput<PrimitiveType>{ 100,  99 },  //step #22
      InputOutput<PrimitiveType>{ 100, 100 },  //step #23
      InputOutput<PrimitiveType>{ 100, 100 },  //step #24
      InputOutput<PrimitiveType>{ 100, 100 },  //step #25
      InputOutput<PrimitiveType>{ 100, 100 },  //step #26
      InputOutput<PrimitiveType>{ 100, 100 },  //step #27

    };

    TestCommon::test_steps_repeatedly(block, steps, loopCount, errorTolerance);

  };//end of test function

  return func;
}





//The following define which tester to use for particular types.
template <> void* get_tester<fc8_IirAccelAsymLowPass>(void) { return new IirAccelAsymLowPassTester<fc8_IirAccelAsymLowPass>; }
template <> void* get_tester<fc32_IirAccelAsymLowPass>(void) { return new IirAccelAsymLowPassTester<fc32_IirAccelAsymLowPass>; }
template <> void* get_tester<fcflt_IirAccelAsymLowPass>(void) { return new IirAccelAsymLowPassTester<fcflt_IirAccelAsymLowPass>; }




/**
* Instantiate
*/
#undef IirAccelAsymLowPass
INSTANTIATE_TYPED_TEST_CASE_P(IirAccelAsymLowPass, IBlockTests, TypesToTest);


