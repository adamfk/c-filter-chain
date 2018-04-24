#include "TestCommon.hpp"
#include "all_types.h"
#include "BasicTests.hpp"

using testing::Types;

typedef Types<fc32_PassThrough, fc8_PassThrough, fcflt_PassThrough> TypesToTest;



template <typename BlockType>
class PassThroughCtorGrp : public StoredFuncsCtorGroup<BlockType> {

public:
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) {
    return [=](BlockType* block) {
      //nothing to test as PassThrough
    };
  }

};






template <typename BlockType> 
class PassThroughTester : public StoredStandardBlockTester<BlockType>
{
  using PrimitiveType = PrimitiveType; //we inherit PrimitiveType, but this line helps intellisense
public:
  virtual ICtorGroup<BlockType>* buildSimpleCtors(void) override
  {
    auto ctorGroup = new PassThroughCtorGrp<BlockType>();
    
    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new<BlockType>(bc);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new_iblock<BlockType>(bc);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        return block;
      },
    };

    ctorGroup->stepTestFuncs.push_back( [=](BlockType* block) {
      sfcg_SET_LOCATION_INFO(*ctorGroup);

      BlockType* passThrough = block;
      //fc32_PassThrough* passThrough = (fc32_PassThrough*)block;

      const PrimitiveType init_value = 68;
      CppX_preload(passThrough, init_value);

      vector<PrimitiveType> inputs = { 123, 74, -45, 16 };
      vector<PrimitiveType> outputs = inputs;
      TestCommon::xtest_block(passThrough, inputs, outputs);
    });


    return ctorGroup;
  }


  virtual ICtorGroup<BlockType>* buildMemGrindCtors(void) override
  {
    auto ctorGroup = new PassThroughCtorGrp<BlockType>();

    ctorGroup->ctors = {
      [=](fc_BuildCtx* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new<BlockType>(bc);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new_iblock<BlockType>(bc);
      },
    };

    ctorGroup->stepTestFuncs.push_back([=](BlockType* block) {
      sfcg_SET_LOCATION_INFO(*ctorGroup);
      TestCommon::preload_step_random_no_expect<BlockType>(block, 100);
    });

    return ctorGroup;
  }
};




template <> void* get_tester<fc8_PassThrough>(void) { return new PassThroughTester<fc8_PassThrough>; }
template <> void* get_tester<fc32_PassThrough>(void) { return new PassThroughTester<fc32_PassThrough>; }
template <> void* get_tester<fcflt_PassThrough>(void) { return new PassThroughTester<fcflt_PassThrough>; }





#undef PassThrough
INSTANTIATE_TYPED_TEST_CASE_P(PassThrough, IBlockTests, TypesToTest);



//TODO create a rtest_step function


TEST(fc32_PassThrough, _new_step)
{
  TestCommon::run_with_mb([](fc_BuildCtx* mb) {
    fc32_PassThrough* p1 = fc32_PassThrough_new(mb);
    using PrimitiveType = FilterPrimitiveTypeSelector<decltype(*p1)>::type;


    const PrimitiveType init_value = 6468;
    fc32_PassThrough_preload(p1, init_value);

    vector<PrimitiveType> inputs = { 235, 7574, -459, 156 };
    vector<PrimitiveType> outputs = inputs;
    TestCommon::xtest_block(p1, inputs, outputs);
  });
}









using testing::Types;



typedef struct RedFilter8 { int8_t  number; } RedFilter8;
typedef struct RedFilter16 { int16_t number; } RedFilter16;

typedef struct BlueFilter8 { int8_t  number; } BlueFilter8;
typedef struct BlueFilter16 { int16_t number; } BlueFilter16;



template <typename Tuple>
class FilterTestSuite : public testing::Test {
protected:
  using FilterType = typename std::tuple_element<0, Tuple>::type;
  using PrimitiveType = typename std::tuple_element<1, Tuple>::type;
};
TYPED_TEST_CASE_P(FilterTestSuite);


template <typename Tuple>
class DerivativeSuite : public FilterTestSuite<Tuple> {
  using PrimitiveType = PrimitiveType;  //helps Visual Studio 2015 intellisense
  using FilterType = FilterType;        //helps Visual Studio 2015 intellisense

  virtual void test_stuff() {
    PrimitiveType p;
  }
};

TYPED_TEST_P(FilterTestSuite, first_test) {
  FilterType filter;

  PrimitiveType a = 67;
  PrimitiveType b = 99;
  auto z = a*b;
}

REGISTER_TYPED_TEST_CASE_P(FilterTestSuite, first_test);

typedef Types<std::tuple<RedFilter8, int8_t>, std::tuple<RedFilter16, int16_t>> RedTypes;
INSTANTIATE_TYPED_TEST_CASE_P(RedTests, FilterTestSuite, RedTypes);

typedef Types<std::tuple<BlueFilter8, int8_t>, std::tuple<BlueFilter16, int16_t>> BlueTypes;
INSTANTIATE_TYPED_TEST_CASE_P(BlueTests, FilterTestSuite, BlueTypes);



template <typename FilterType>
static void test_x() {
  FilterType f;
  //using PrimitiveType = FilterPrimitiveTypeSelector<decltype(f)>::type;
  using PrimitiveType = FilterPrimitiveTypeSelector<FilterType>::type;

  PrimitiveType a = 100;
  PrimitiveType b = 15;
}

TEST(type_tests, test_x) {
  test_x<fc8_PassThrough>();
  test_x<fc32_PassThrough>();
}

