
#define IirLowPass               FC_MAKE_NAME(IirLowPass)
#define IirLowPass_ctor          FC_MAKE_NAME(IirLowPass_ctor)
#define IirLowPass_new           FC_MAKE_NAME(IirLowPass_new)
#define IirLowPass_new_iblock        FC_MAKE_NAME(IirLowPass_new_iblock)
#define IirLowPass_step        FC_MAKE_NAME(IirLowPass_step)
#define IirLowPass_preload       FC_MAKE_NAME(IirLowPass_preload)

#define IirLowPass_Test_type     FC_MAKE_NAME(IirLowPass_Test_type)



/**
* Structure for a single order low pass IIR filter
*/
typedef struct IirLowPass
{
  IBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float new_ratio;
  fc_PTYPE last_output;
} IirLowPass;


void IirLowPass_ctor(IirLowPass* block);
IirLowPass* IirLowPass_new(fc_BuildCtx* bc, float new_ratio);
IBlock* IirLowPass_new_iblock(fc_BuildCtx* bc, float new_ratio);

/**
 * Class method.
 * Use to check if an IBlock is a IirLowPass.
 */
bool IirLowPass_Test_type(void* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirLowPass_preload(void* self, fc_PTYPE input);
fc_PTYPE IirLowPass_step(void* self, fc_PTYPE input);




//#########################################################################################################
// Emscripten stuff
//#########################################################################################################

#if defined(__cplusplus) && defined(__EMSCRIPTEN__)

static void EmIirLowPass_preload(IirLowPass* self, fc_PTYPE input) {
  IirLowPass_preload(self, input);
}
static fc_PTYPE EmIirLowPass_step(IirLowPass* self, fc_PTYPE input) {
  return IirLowPass_step(self, input);
}

//casting back and forth from these functions worked :)
static IBlock* ilpToIblock(IirLowPass* block) {
  return (IBlock*)block;
}
static IirLowPass* iblockToIlp(IBlock* iblock) {
  return (IirLowPass*)iblock;
}


extern "C++" {

#include <emscripten/bind.h>
using namespace emscripten;


#include "fc_lib/fc_Mallocator.h"

//static fc_IAllocator const * getMallocator(void) {
//  return &fc_Mallocator;
//}
//
#include "fc_lib/fc_allocate.h"
static IBlock* const get_ALLOCATE_FAIL_PTR() {
  return (IBlock*)fc_ALLOCATE_FAIL_PTR;
}

static bool is_FAIL_PTR(IBlock* b) {
  return b == fc_ALLOCATE_FAIL_PTR;
}

static fc_BuildCtx makeMallocatorBuildContext() {
  fc_BuildCtx bc = {};
  bc.allocator = &fc_Mallocator;
  return bc;
}

EMSCRIPTEN_BINDINGS(IirLowPass) {

  function("get_ALLOCATE_FAIL_PTR", get_ALLOCATE_FAIL_PTR, allow_raw_pointers());
  function("is_FAIL_PTR", is_FAIL_PTR, allow_raw_pointers());


  //class_<fc_IAllocator>("fc_IAllocator")
  //  .constructor<>();

  function("makeMallocatorBuildContext", makeMallocatorBuildContext, allow_raw_pointers());
  


  class_<fc_BuildCtx>("fc_BuildCtx")
    .constructor<>()
    //.property("allocator", &fc_BuildCtx::allocator, allow_raw_pointers()) //emcc doesn't like this
    .property("min_working_buffer_size", &fc_BuildCtx::min_working_buffer_size)
    .property("one_or_more_failures", &fc_BuildCtx::one_or_more_failures)
    ;
  

  class_<IirLowPass>("IirLowPass")
    .constructor<>()
    .property("block", &IirLowPass::block)
    .property("new_ratio", &IirLowPass::new_ratio)
    .property("last_output", &IirLowPass::last_output)
    ;

  function("ilpToIblock", ilpToIblock, allow_raw_pointers());
  function("iblockToIlp", iblockToIlp, allow_raw_pointers());

  function("IirLowPass_ctor", IirLowPass_ctor, allow_raw_pointers());
  function("IirLowPass_new", IirLowPass_new, allow_raw_pointers());

  function("EmIirLowPass_preload", EmIirLowPass_preload, allow_raw_pointers());
  function("EmIirLowPass_step", EmIirLowPass_step, allow_raw_pointers());
}

} //end extern c++
#endif



//#########################################################################################################
// Unit testing stuff
//#########################################################################################################

//The following methods are useful for unit testing using generic C++ code.
//THESE functions must be static because they are defined in a header
#if defined(__cplusplus) && defined(fc_UNIT_TESTING)
extern "C++" {

#ifndef _fc_CPP_TEST_IIR_LOW_PASS_INCLUDE_GUARD
#define _fc_CPP_TEST_IIR_LOW_PASS_INCLUDE_GUARD
  template <typename BlockType>
  static BlockType* CppIirLowPass_new(fc_BuildCtx* bc, float new_ratio);

  template <typename BlockType>
  static BlockType* CppIirLowPass_new_iblock(fc_BuildCtx* bc, float new_ratio);
#endif


  template <>
  static IirLowPass* CppIirLowPass_new<IirLowPass>(fc_BuildCtx* bc, float new_ratio) {
    return IirLowPass_new(bc, new_ratio);
  }

  template <>
  static IirLowPass* CppIirLowPass_new_iblock<IirLowPass>(fc_BuildCtx* bc, float new_ratio) {
    return (IirLowPass*)IirLowPass_new_iblock(bc, new_ratio);
  }


  //TODO rename CppHelperFilterType to CppHelperBlockType
  #define CppHelperFilterType     IirLowPass
  #include "fc_lib/templates/fc_cpp_helper.ipp"
}

#endif