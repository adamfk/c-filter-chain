
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