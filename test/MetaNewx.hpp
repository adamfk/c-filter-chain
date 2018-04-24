#pragma once
#include <vector>



//essentially a typedef for `std::function<void(BlockType* block)>`
//https://stackoverflow.com/questions/2795023/c-template-typedef
template <typename BlockType>
using StepFunc = std::function<void(BlockType* block)>;


//essentially a templated typedef
template <typename BlockType>
using Ctor = std::function<BlockType*(fc_BuildCtx*)>;




/**
 * A constructor group is a group of constructor functions that all construct equivalent
 * objects. They may call different functions, manually allocate... but the objects 
 * constructed must all be equivalent.
 */
template <typename BlockType> class ICtorGroup {
protected:
  typedef BlockType const * DummyT;  //TODO look at removing * from DummyT. sizeof(dummy) is a common mistake as you want sizeof(*dummy)
  DummyT dummy = nullptr;    //see README.md "Dummy Variables" section 

public:

  /**
   * The constructor functions returned are intended to test that all of the possible
   * constructors available for a filter will result in equivalent constructed objects.
   * At a minimum, must all:
   * - have the same number of allocations and allocated byte sum.
   * - pass the same state test function returned by `getBlockFieldsTestFunc()`.
   * 
   * There should a constructor function for at least the following:
   * - `MyFilter_ctor()` where you manually allocate any dependencies.
   * - `MyFilter_new()`
   * - `MyFilter_new_iblock()`
   */
  virtual std::vector<Ctor<BlockType>> getCtors(void) = 0;

  /**
   * The returned test function is responsible for ensuring that a constructed
   * block has the expected field values (state).
   */
  virtual std::function<void(BlockType* block)> getBlockFieldsTestFunc(void) = 0;

  /**
   * The returned test functions are responsible for testing the `step` 
   * functionality of a block.
   */
  virtual std::vector<StepFunc<BlockType>> getStepTestFuncs(void) = 0;

  /**
   * Each constructor in this group is expected to allocate this number of bytes.
   */
  virtual size_t getExpectedAllocSum(void) = 0;

  /**
   * Each constructor in this group is expected to allocate this number of times.
   */
  virtual int getExpectedAllocCount(void) = 0;

  /**
   * TODO rework
   * Provides optional descriptive text (perhaps __FILE__, __LINE__, or relevant 
   * field configurations) about the constructor groups.
   */
  virtual std::string getDescription(void) { return "not-described"; };

  virtual char const * getLocationFilePath(void) = 0;
  virtual int getLocationLineNumber(void) = 0;
  virtual void setLocationInfo(char const * filepath, int lineNumber) = 0;

  /**
   * Call this before using.
   */
  virtual void setup() {};
};



#define sfcg_SET_LOCATION_INFO(storedFuncsCtorGroup) \
  (storedFuncsCtorGroup).setLocationInfo(__FILE__, __LINE__)


template <typename BlockType>
class StoredFuncsCtorGroup : public ICtorGroup<BlockType> {
protected:
  bool is_setup = false;

public:
  std::vector<Ctor<BlockType>> ctors = {};
  std::function<void(BlockType* block)> blockFieldsTestFunc;
  char const * locationFilePath = {};
  int locationLineNumber = 0;
  std::vector<StepFunc<BlockType>> stepTestFuncs; //TODOLOW put in get/set

  /**
   * CANNOT call this in the current class constructor as the the proper 
   * virtual `buildBlockFieldsTestFunc( )` will not be called as the vtable isn't fully constructed yet.
   */
  virtual void setup() override {
    if (!is_setup) {
      blockFieldsTestFunc = buildBlockFieldsTestFunc();
      is_setup = true;
    }
  }

  virtual ~StoredFuncsCtorGroup() {}



  virtual std::vector<StepFunc<BlockType>> getStepTestFuncs(void) override {
    return stepTestFuncs;
  }

  
  virtual size_t getExpectedAllocSum(void) override {
    return sizeof(BlockType);
  }

  virtual int getExpectedAllocCount(void) override {
    return 1;
  }

  virtual std::vector<Ctor<BlockType>> getCtors(void) override {
    return ctors;
  }

  virtual std::function<void(BlockType*)> getBlockFieldsTestFunc(void) override {
    return blockFieldsTestFunc; 
  }

  virtual std::string getDescription(void) override {
    return nullptr;
  }

  virtual char const * getLocationFilePath(void) override {
    return locationFilePath;
  };

  virtual int getLocationLineNumber(void) override {
    return locationLineNumber;
  }

  virtual void setLocationInfo(char const * filepath, int lineNumber) override {
    locationFilePath = filepath;
    locationLineNumber = lineNumber;
  }

  /**
   * Creates the function that will be returned to `ICtorGroup.getBlockFieldsTestFunc( )`
   */
  virtual std::function<void(BlockType*)> buildBlockFieldsTestFunc(void) = 0;

  virtual void addNoCrashStepTestFunc() {
    auto thisCtorGroup = this;
    stepTestFuncs.push_back([=](BlockType* block) {
      sfcg_SET_LOCATION_INFO(*thisCtorGroup);
      TestCommon::preload_step_random_no_expect<BlockType>(block, 100);
    });
  }

};




