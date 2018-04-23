#include "TestCommon.hpp"
#include "all_types.h"
#include "fc_lib/fcflt_lib.h"
#include "BasicTests.hpp"


using testing::Types;


/**
 * Define which primitive types will be used to test the Median filter implementation.
 */
typedef Types<fc32_Median, fc8_Median, fcflt_Median> TypesToTest;




//forward declare
template <typename BlockType>
static std::function<void(BlockType* block)> get_step_test_filter_length_3_func(void);




/**
 * Define how the Median constructors will be tested. See `ICtorGroup` for more detail.
 */
template <typename BlockType>
class MedianCtorGroup : public StoredFuncsCtorGroup<BlockType> {

public:
  using StoredFuncsCtorGroup::StoredFuncsCtorGroup; //to inherit parent constructors

  /**
   * Determines the filter length for all Median filter constructors in this group.
   */
  int filter_length;

  /**
   * Builds the function that will test ALL the fields in a constructed Median block.
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    auto thisCtorGroup = this;
    return [=](BlockType* block) {
      sfcg_SET_LOCATION_INFO(*thisCtorGroup);
      EXPECT_NE(block->previous_samples, nullptr);
      EXPECT_EQ(block->saved_sample_length, this->filter_length - 1);
      EXPECT_NE(block->working_buffer, nullptr);
    };
  }

  /**
   * Returns the number of bytes that is expected to be allocated from one
   * of the constructors in this group.
   */
  virtual size_t getExpectedAllocSum(void) {
    int saved_sample_length = filter_length - 1;
    size_t size = sizeof(*dummy) + saved_sample_length * sizeof(dummy->previous_samples[0]);
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
    std::string result = "filter length: " + std::to_string(filter_length);
    return result;
  }
};






/**
 * Provides methods that will allow the base `StandardBlockTester` class to 
 * test and validate the Median filter block implementation.
 */
template <typename BlockType> 
class MedianTester : public StoredStandardBlockTester<BlockType>
{
public:
  using PrimitiveType = PrimitiveType; //we inherit PrimitiveType, but this line helps intellisense

  /**
   * Defines "C++" wrapper functions that will exercise each and every "c" constructor function.
   * All of the "C++" constructor functions MUST produce an equivalent Median filter block
   * when compared to each other. The constructed blocks must all function the same,
   * and have the same allocation pattern.
   */
  virtual ICtorGroup<BlockType>* buildSimpleCtors(void) override
  {
    auto ctorGroup = buildSimpleCtorsFromLength(3);
    ctorGroup->stepTestFuncs.push_back(get_step_test_filter_length_3_func<BlockType, PrimitiveType>(ctorGroup));
    return ctorGroup;
  }


  /**
   * Defines "C++" wrapper functions that will utilize each and every "c" constructor function THAT allocates internally.
   * Why? Because we test every possible combination of allocation failure to ensure that every allocating
   * constructor function behaves as expected.
   */
  virtual MedianCtorGroup<BlockType>* buildMemGrindCtors(void) override
  {
    const int filter_length = Randomization::get_int(1, 2000);

    auto ctorGroup = new MedianCtorGroup<BlockType>();
    
    ctorGroup->ctors = {
      [=](fc_Builder* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppMedian_new<BlockType>(bc, filter_length);
      },
      [=](fc_Builder* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppMedian_new_iblock<BlockType>(bc, filter_length);
      },
      //Doesn't make sense to provide function constructing via `Median_ctor` as then you have to manually code 
      // all the allocation failures which are already handled in `CppMedian_new` and `CppMedian_new_iblock`
    };

    //add random step tester that only ensures that the filter doesn't crash
    ctorGroup->stepTestFuncs.push_back([=](BlockType* block) {
      sfcg_SET_LOCATION_INFO(*ctorGroup);
      TestCommon::preload_step_random_no_expect<BlockType>(block, 100);
    });

    ctorGroup->filter_length = filter_length;
    return ctorGroup;
  }


private:
  MedianCtorGroup<BlockType>* buildSimpleCtorsFromLength(uint16_t filter_length)
  {
    auto ctorGroup = new MedianCtorGroup<BlockType>();

    ctorGroup->ctors = {
      [=](fc_Builder* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppMedian_new<BlockType>(bc, filter_length);
      },
      [=](fc_Builder* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppMedian_new_iblock<BlockType>(bc, filter_length);
      },
      [=](fc_Builder* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);

        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        block->working_buffer = bc->working_buffer;
        block->saved_sample_length = filter_length - 1;
        block->previous_samples = (PrimitiveType*)fc_IAllocator_allocate(bc->allocator, sizeof(PrimitiveType)*block->saved_sample_length);
        size_t wb_size = sizeof(PrimitiveType) * filter_length;
        fc_Builder_update_minimum_working_buffer(bc, wb_size);
        return block;
      },
    };

    ctorGroup->filter_length = filter_length;
    return ctorGroup;
  }

};
  


template <typename BlockType, typename PrimitiveType>
static StepFunc<BlockType> get_step_test_filter_length_3_func(ICtorGroup<BlockType>* ctorGroup) {
  auto func = [=](BlockType* block) {
    sfcg_SET_LOCATION_INFO(*ctorGroup);
    //fc32_Median* median = (fc32_Median*)block; //uncomment line for when you want intellisense. Do not leave in though.
    BlockType* median = block;

    const int filter_length = 3;

    //this test is for a Median filter of length 3
    ASSERT_GE(median->saved_sample_length + 1, filter_length);

    //ensure working buffer setup
    ASSERT_GE(median->working_buffer->size, filter_length * sizeof(median->previous_samples[0]));

    {
      SCOPED_TRACE("First");
      CppX_preload(median, 1);
      vector<PrimitiveType> inputs = { 1, 7, 1, 1, 1 };
      vector<PrimitiveType> expected_outputs = { 1, 1, 1, 1, 1 };
      TestCommon::xtest_block(median, inputs, expected_outputs);
    }

    {
      SCOPED_TRACE("2nd");
      CppX_preload(median, 1);
      vector<PrimitiveType> inputs = { 1, 7, -7, 1, 1 };
      vector<PrimitiveType> expected_outputs = { 1, 1, 1, 1, 1 };
      TestCommon::xtest_block(median, inputs, expected_outputs);
    }

    {
      SCOPED_TRACE("3rd");
      CppX_preload(median, 1);
      vector<PrimitiveType> inputs = { 1, 7, 7, 1, 1 };
      vector<PrimitiveType> expected_outputs = { 1, 1, 7, 7, 1 };
      TestCommon::xtest_block(median, inputs, expected_outputs);
    }
  };//end of test function

  return func;
}
  




//The following define which tester to use for particular types.
template <> void* get_tester<fc8_Median>(void)   { return new MedianTester<fc8_Median>; }
template <> void* get_tester<fc32_Median>(void)  { return new MedianTester<fc32_Median>; }
template <> void* get_tester<fcflt_Median>(void) { return new MedianTester<fcflt_Median>; }




/**
 * Instantiate 
 */
#undef Median
INSTANTIATE_TYPED_TEST_CASE_P(Median, IBlockTests, TypesToTest);

