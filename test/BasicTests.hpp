#include "TestCommon.hpp"
#include <typeindex>
#include <typeinfo>
#include "MetaNewx.hpp"

typedef void* (*build_funcp_t)(void);




template <typename BlockType> class StandardBlockTester {
public:

  using PrimitiveType = typename FilterPrimitiveTypeSelector<BlockType>::type;

  typedef BlockType const * DummyT; //TODO look at removing * from DummyT. sizeof(dummy) is a common mistake as you want sizeof(*dummy)
  DummyT dummy = nullptr;    //see README.md "Dummy Variables" section 
  
  typedef std::function<BlockType*(fc_BuildCtx*)> x_new_func_t;
  typedef std::function<void*(fc_BuildCtx*)> x_new_iblock_func_t;
  typedef std::function<bool(void* iblock)> x_test_type_t;
 

  virtual vector<ICtorGroup<BlockType>*> getSimpleCtorGroups(void) = 0;
  virtual vector<ICtorGroup<BlockType>*> getMemGrindCtorGroups(void) = 0;
  virtual void setup(void) { };

  virtual x_test_type_t get_test_type_func(DummyT dummy) {
    return [=](void* iblock) { return CppX_Test_type<BlockType>(iblock); };
  }
  virtual x_test_type_t get_test_type_func() { return get_test_type_func(dummy); }


  /*
    Reason for pattern:
    - allow running tests without passing a dummy var for the type
      via something like `rtest_new_destroy()`
    - allow derived classes to override tests for *specfic* types
      via something like `rtest_new_destroy(fc32_PassThrough const * dummy)`
  */


  virtual void rtest_newx(DummyT dummy) {
    SCOPED_TRACE(__func__);
    TestCommon::build_test_destruct2(getSimpleCtorGroups());
  }
  virtual void rtest_newx() { rtest_newx(dummy); }


  virtual void rtest_Test_type(DummyT dummy) {
    SCOPED_TRACE(__func__);
    TestCommon::test_type_testing(getSimpleCtorGroups(), get_test_type_func());
  }
  virtual void rtest_Test_type() { rtest_Test_type(dummy); };


  virtual void rtest_run_visitor(DummyT dummy) {
    SCOPED_TRACE(__func__);
    TestCommon::test_simple_visitor(getSimpleCtorGroups());
  }
  virtual void rtest_run_visitor() { rtest_run_visitor(dummy); }


  virtual void rtest_verify_alloc_free(DummyT dummy) {
    SCOPED_TRACE(__func__);
    auto ctorGroups = getMemGrindCtorGroups();
    for (size_t i = 0; i < 100; i++) {
      TestCommon::build_verify_alloc_free(ctorGroups);
      RETURN_IF_ANY_FAILURE();
    }
  }
  virtual void rtest_verify_alloc_free(void) { rtest_verify_alloc_free(dummy); }

};




template <typename BlockType>
class StoredStandardBlockTester : public StandardBlockTester<BlockType>
{

private:
  bool is_setup;
  vector<ICtorGroup<BlockType>*> simpleCtorGroups;
  vector<ICtorGroup<BlockType>*> memGrindCtorGroups;

public:

  virtual ~StoredStandardBlockTester() {
    for each (auto ctorGroup in simpleCtorGroups) {
      delete ctorGroup;
    }
    for each (auto ctorGroup in memGrindCtorGroups) {
      delete ctorGroup;
    }
  }

  virtual void setup(void) override {
    if (!is_setup) 
    {
      simpleCtorGroups = buildSimpleCtorGroups();
      for each (auto ctorGroup in simpleCtorGroups) {
        ctorGroup->setup();
      }
      
      memGrindCtorGroups = buildMemGrindCtorGroups();
      for each (auto ctorGroup in memGrindCtorGroups) {
        ctorGroup->setup();
      }

      is_setup = true;
    }
  }

  virtual vector<ICtorGroup<BlockType>*> getSimpleCtorGroups(void) override {
    setup();
    return simpleCtorGroups;
  }

  virtual vector<ICtorGroup<BlockType>*> getMemGrindCtorGroups(void) override {
    setup();
    return memGrindCtorGroups;
  }

  /**
   * Expected to allocate so that they can be deleted.
   * See `ICtorGroup<BlockType>` for more details.
   */
  virtual vector<ICtorGroup<BlockType>*> buildSimpleCtorGroups(void) = 0;

  /**
   * Expected to allocate so that they can be deleted.
   * See `ICtorGroup<BlockType>` for more details.
   */
  virtual vector<ICtorGroup<BlockType>*> buildMemGrindCtorGroups(void) = 0;

};






template <typename BlockType>
void* get_tester(void);




//NOTE! a test suite CANNOT be in a namespace and used in another file. The syntax is 
//incompatible with google test macros
template <class BlockType>
class IBlockTests : public testing::Test {
protected:
  StandardBlockTester<BlockType>* tester;
  IBlockTests() {
    tester = (StandardBlockTester<BlockType>*)get_tester<BlockType>();
    tester->setup();
  }

  void SetUp() {
    
  }

  virtual ~IBlockTests() { 
    delete tester;
  }
};

TYPED_TEST_CASE_P(IBlockTests);

TYPED_TEST_P(IBlockTests, newx) {
  tester->rtest_newx();
}

TYPED_TEST_P(IBlockTests, run_visitor) {
  tester->rtest_run_visitor();
}

TYPED_TEST_P(IBlockTests, Test_type) {
  tester->rtest_Test_type();
}

TYPED_TEST_P(IBlockTests, alloc_free) {
  tester->rtest_verify_alloc_free();
}

REGISTER_TYPED_TEST_CASE_P(IBlockTests,
  newx,
  run_visitor,
  Test_type,
  alloc_free
);



