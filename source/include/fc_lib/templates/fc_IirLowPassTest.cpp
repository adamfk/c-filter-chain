#include "TestCommon.hpp"
#include "all_types.h"
#include "fc_lib/fcflt_lib.h"
#include "BasicTests.hpp"


using testing::Types;


/**
* Define which primitive types will be used to test the IirLowPass filter implementation.
*/
typedef Types<fc32_IirLowPass, fc8_IirLowPass, fcflt_IirLowPass> TypesToTest;




//forward declare
template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> get_step_test_20_percent(ICtorGroup<BlockType>* ctorGroup);



/**
* Define how the IirLowPass constructors will be tested. See `ICtorGroup` for more detail.
*/
template <typename BlockType>
class IirLowPassCtorGroup : public StoredFuncsCtorGroup<BlockType> {

public:
  using StoredFuncsCtorGroup::StoredFuncsCtorGroup; //to inherit parent constructors

  //expected value for objects constructed in this group
  float expected_new_ratio;

  /**
   * Builds the function that will test ALL the fields in a constructed IirLowPass block.
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    auto thisCtorGroup = this;
    return [=](BlockType* block) {
      //fc8_IirLowPass* b;
      EXPECT_EQ(block->last_output, 0);
      EXPECT_EQ(block->new_ratio, expected_new_ratio);
    };
  }

};






/**
* Provides methods that will allow the base `StandardBlockTester` class to
* test and validate the IirLowPass filter block implementation.
*/
template <typename BlockType>
class IirLowPassTester : public StoredStandardBlockTester<BlockType>
{
public:
  using PrimitiveType = PrimitiveType; //we inherit PrimitiveType, but this line helps intellisense


  virtual vector<ICtorGroup<BlockType>*> buildSimpleCtorGroups(void) override
  {
    vector<ICtorGroup<BlockType>*> groups;

    const float new_ratio = 0.2f;
    auto group = buildSimpleCtorsWithNewRatio(new_ratio);
    group->stepTestFuncs.push_back(get_step_test_20_percent<BlockType, PrimitiveType>(group));
    groups.push_back(group);
    return groups;
  }


  /**
  * Defines "C++" wrapper functions that will utilize each and every "c" constructor function THAT allocates internally.
  * Why? Because we test every possible combination of allocation failure to ensure that every allocating
  * constructor function behaves as expected.
  */
  virtual vector<ICtorGroup<BlockType>*> buildMemGrindCtorGroups(void) override
  {
    vector<ICtorGroup<BlockType>*> groups;

    const float new_ratio = Randomization::get_for_type<float>();

    auto ctorGroup = new IirLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirLowPass_new<BlockType>(bc, new_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirLowPass_new_iblock<BlockType>(bc, new_ratio);
      },
    };

    ctorGroup->addNoCrashStepTestFunc();
    ctorGroup->expected_new_ratio = new_ratio;

    groups.push_back(ctorGroup);

    return groups;
  }


private:
  IirLowPassCtorGroup<BlockType>* buildSimpleCtorsWithNewRatio(float new_ratio)
  {
    auto ctorGroup = new IirLowPassCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirLowPass_new<BlockType>(bc, new_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppIirLowPass_new_iblock<BlockType>(bc, new_ratio);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);

        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        block->new_ratio = new_ratio;
        return block;
      },
    };

    ctorGroup->expected_new_ratio = new_ratio;
    return ctorGroup;
  }

};






template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> get_step_test_20_percent(ICtorGroup<BlockType>* ctorGroup) {
  auto func = [=](BlockType* block) {
    ASSERT_EQ(block->new_ratio, 0.2f);

    CppX_preload(block, 0);
    
    int32_t error_tolerance = 1;
    const vector<PrimitiveType> inputs =           { 100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100, };
    const vector<PrimitiveType> expected_outputs = { 20,  36, 49, 59, 67, 74, 79, 83, 87, 89, 91, 93, 95, 96, 96, 97, 98, 98, 99, };
    TestCommon::xtest_block(block, inputs, expected_outputs, error_tolerance);
    
  };//end of test function

  return func;
}





//The following define which tester to use for particular types.
template <> void* get_tester<fc8_IirLowPass>(void) { return new IirLowPassTester<fc8_IirLowPass>; }
template <> void* get_tester<fc32_IirLowPass>(void) { return new IirLowPassTester<fc32_IirLowPass>; }
template <> void* get_tester<fcflt_IirLowPass>(void) { return new IirLowPassTester<fcflt_IirLowPass>; }




/**
* Instantiate
*/
#undef IirLowPass
INSTANTIATE_TYPED_TEST_CASE_P(IirLowPass, IBlockTests, TypesToTest);

