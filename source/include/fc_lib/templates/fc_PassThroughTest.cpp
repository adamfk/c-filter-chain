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
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new<BlockType>(bc);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new_iblock<BlockType>(bc);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        //vanilla method of setting it up
        BlockType* block = (BlockType*)fc_IAllocator_allocate(bc->allocator, sizeof(BlockType));
        CppX_ctor(block);
        return block;
      },
    };

    ctorGroup->stepTestFuncs.push_back( [=](BlockType* block) {
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
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new<BlockType>(bc);
      },
      [=](fc_BuildCtx* bc) {
        sfcg_SET_CTOR_LOCATION_INFO(*ctorGroup);
        return CppPassThrough_new_iblock<BlockType>(bc);
      },
    };

    ctorGroup->stepTestFuncs.push_back([=](BlockType* block) {
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
  TestCommon::runWithBuildCtx([](fc_BuildCtx* bc) {
    fc32_PassThrough* p1 = fc32_PassThrough_new(bc);
    using PrimitiveType = FilterPrimitiveTypeSelector<decltype(*p1)>::type;


    const PrimitiveType init_value = 6468;
    fc32_PassThrough_preload(p1, init_value);

    vector<PrimitiveType> inputs = { 235, 7574, -459, 156 };
    vector<PrimitiveType> outputs = inputs;
    TestCommon::xtest_block(p1, inputs, outputs);
  });
}






