#include "TestCommon.hpp"
#include "all_types.h"
#include "fc_lib/fcflt_lib.h"
#include "BasicTests.hpp"


using testing::Types;


/**
 * Define which primitive types will be used to test the Delay filter implementation.
 */
typedef Types<fc32_Delay, fc8_Delay, fcflt_Delay> TypesToTest;




//forward declare
template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> get_step_test_filter_length_3_func(ICtorGroup<BlockType>* ctorGroup);




/**
 * Define how the Delay constructors will be tested. See `ICtorGroup` for more detail.
 */
template <typename BlockType>
class DelayCtorGroup : public StoredFuncsCtorGroup<BlockType> {

public:

  int saved_sample_length;

  /**
   * Builds the function that will test ALL the fields in a constructed Delay block.
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    return [=](BlockType* block) {
      EXPECT_NE(block->previous_samples, nullptr);
      EXPECT_EQ(block->saved_sample_length, this->saved_sample_length);
    };
  }

  /**
   * Returns the number of bytes that is expected to be allocated from one
   * of the constructors in this group.
   */
  virtual size_t getExpectedAllocSum(void) {
    size_t size = sizeof(BlockType) + saved_sample_length * sizeof(dummy->previous_samples[0]);
    return size;
  }

  /**
   * Returns the number of times any constructor in this group is expected
   * to allocate.
   */
  virtual int getExpectedAllocCount(void) { return 2; }

  /**
   * Descriptive text about this constructor group.
   */
  virtual std::string getDescription(void) {
    std::string result = "filter length: " + std::to_string(saved_sample_length);
    return result;
  }
};






/**
 * Provides methods that will allow the base `StandardBlockTester` class to 
 * test and validate the Delay filter block implementation.
 */
template <typename BlockType> 
class DelayTester : public StoredStandardBlockTester<BlockType>
{
public:
  using PrimitiveType = PrimitiveType; //we inherit PrimitiveType, but this line helps intellisense

  /**
   * Defines "C++" wrapper functions that will exercise each and every "c" constructor function.
   * All of the "C++" constructor functions MUST produce an equivalent Delay filter block
   * when compared to each other. The constructed blocks must all function the same,
   * and have the same allocation pattern.
   */
  virtual vector<ICtorGroup<BlockType>*> buildSimpleCtorGroups(void) override
  {
    vector<ICtorGroup<BlockType>*> groups;
    auto ctorGroup = buildSimpleCtorsFromLength(3);
    ctorGroup->stepTestFuncs.push_back(get_step_test_filter_length_3_func<BlockType, PrimitiveType>(ctorGroup));
    groups.push_back(ctorGroup);
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

    const int filter_length = Randomization::get_int(1, 2000);

    auto ctorGroup = new DelayCtorGroup<BlockType>();
    
    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppDelay_new<BlockType>(bc, filter_length);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppDelay_new_iblock<BlockType>(bc, filter_length);
      },
      //Doesn't make sense to provide function constructing via `Delay_ctor` as then you have to manually code 
      // all the allocation failures which are already handled in `CppDelay_new` and `CppDelay_new_iblock`
    };

    //add random step tester that only ensures that the filter doesn't crash
    ctorGroup->addNoCrashStepTestFunc();
    ctorGroup->saved_sample_length = filter_length;

    groups.push_back(ctorGroup);

    return groups;
  }


private:
  DelayCtorGroup<BlockType>* buildSimpleCtorsFromLength(uint16_t filter_length)
  {
    auto ctorGroup = new DelayCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppDelay_new<BlockType>(bc, filter_length);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppDelay_new_iblock<BlockType>(bc, filter_length);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);

        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        block->saved_sample_length = filter_length;
        block->previous_samples = (PrimitiveType*)fc_IAllocator_allocate(bc->allocator, sizeof(block->previous_samples[0]) * block->saved_sample_length);
        return block;
      },
    };

    ctorGroup->saved_sample_length = filter_length;
    return ctorGroup;
  }

};
  


template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> get_step_test_filter_length_3_func(ICtorGroup<BlockType>* ctorGroup) {
  auto func = [=](BlockType* block) {
    fc32_Delay* delay_block = (fc32_Delay*)block; //uncomment line for when you want intellisense. Do not leave in though.
    //BlockType* delay_block = block;

    const double errorTolerance = 0;
    const size_t loopCount = 1;

    const int filter_length = 3;

    //this test is for a delay filter of length 3
    ASSERT_GE(delay_block->saved_sample_length, filter_length);

    CppX_preload(block, 0);

    vector<InputOutput<PrimitiveType>> steps = {
      InputOutput<PrimitiveType>{ 25 , 0   },
      InputOutput<PrimitiveType>{ 44 , 0   },
      InputOutput<PrimitiveType>{ 28 , 0   },
      InputOutput<PrimitiveType>{ 122, 25  },
      InputOutput<PrimitiveType>{ 100, 44  },  //step #5
      InputOutput<PrimitiveType>{ 29 , 28  },  //step #6
      InputOutput<PrimitiveType>{ 51 , 122 },  //step #7
      InputOutput<PrimitiveType>{ 16 , 100 },  //step #8
      InputOutput<PrimitiveType>{ 4  , 29  },  //step #9
      InputOutput<PrimitiveType>{ 61 , 51  },  //step #10
      InputOutput<PrimitiveType>{ 86 , 16  },  //step #11
      InputOutput<PrimitiveType>{ 62 , 4   },  //step #12
      InputOutput<PrimitiveType>{ 84 , 61  },  //step #13
      InputOutput<PrimitiveType>{ 95 , 86  },  //step #14
      InputOutput<PrimitiveType>{ 105, 62  },  //step #15
      InputOutput<PrimitiveType>{ 112, 84  },  //step #16
      InputOutput<PrimitiveType>{ 4  , 95  },  //step #17
    };

    TestCommon::test_steps_repeatedly(block, steps, loopCount, errorTolerance);
  };//end of test function

  return func;
}
  




//The following define which tester to use for particular types.
template <> void* get_tester<fc8_Delay>(void)   { return new DelayTester<fc8_Delay>; }
template <> void* get_tester<fc32_Delay>(void)  { return new DelayTester<fc32_Delay>; }
template <> void* get_tester<fcflt_Delay>(void) { return new DelayTester<fcflt_Delay>; }




/**
 * Instantiate 
 */
#undef Delay
INSTANTIATE_TYPED_TEST_CASE_P(Delay, IBlockTests, TypesToTest);

