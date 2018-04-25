
#define PassThrough               FC_MAKE_NAME(PassThrough)
#define PassThrough_ctor          FC_MAKE_NAME(PassThrough_ctor)
#define PassThrough_new           FC_MAKE_NAME(PassThrough_new)
#define PassThrough_new_iblock    FC_MAKE_NAME(PassThrough_new_iblock)
#define PassThrough_step          FC_MAKE_NAME(PassThrough_step)
#define PassThrough_preload       FC_MAKE_NAME(PassThrough_preload)

#define PassThrough_Test_type     FC_MAKE_NAME(PassThrough_Test_type)


typedef struct PassThrough
{
  IBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
} PassThrough;


void PassThrough_ctor(PassThrough* block);
PassThrough* PassThrough_new(fc_BuildCtx* bc);
IBlock* PassThrough_new_iblock(fc_BuildCtx* bc);

/**
 * Class method.
 * Use to check if an IBlock is a PassThrough block.
 */
bool PassThrough_Test_type(void* some_iblock);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void PassThrough_preload(void* block, fc_PTYPE input);
fc_PTYPE PassThrough_step(void* block, fc_PTYPE input);



//#########################################################################################################
// Unit testing stuff
//#########################################################################################################


//The following methods are useful for unit testing using generic C++ code.
//THESE functions must be static because they are defined in a header
#if defined(__cplusplus) && defined(fc_UNIT_TESTING)
extern "C++" {

#ifndef _fc_CPP_TEST_PASSTHROUGH_INCLUDE_GUARD
#define _fc_CPP_TEST_PASSTHROUGH_INCLUDE_GUARD
  template <typename BlockType>
  static BlockType* CppPassThrough_new(fc_BuildCtx* bc);

  template <typename BlockType>
  static BlockType* CppPassThrough_new_iblock(fc_BuildCtx* bc);
#endif

  template <>
  static PassThrough* CppPassThrough_new(fc_BuildCtx* bc) {
    return PassThrough_new(bc);
  }

  template <>
  static PassThrough* CppPassThrough_new_iblock(fc_BuildCtx* bc) {
    return (PassThrough*)PassThrough_new_iblock(bc);
  }

  #define CppHelperFilterType     PassThrough
  #include "fc_lib/templates/fc_cpp_helper.ipp"

}

#endif


