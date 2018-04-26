#define IirAsymLowPass               FC_MAKE_NAME(IirAsymLowPass)
#define IirAsymLowPass_ctor          FC_MAKE_NAME(IirAsymLowPass_ctor)
#define IirAsymLowPass_new           FC_MAKE_NAME(IirAsymLowPass_new)
#define IirAsymLowPass_new_iblock    FC_MAKE_NAME(IirAsymLowPass_new_iblock)
#define IirAsymLowPass_step          FC_MAKE_NAME(IirAsymLowPass_step)
#define IirAsymLowPass_preload       FC_MAKE_NAME(IirAsymLowPass_preload)

#define IirAsymLowPass_Test_type     FC_MAKE_NAME(IirAsymLowPass_Test_type)


/**
* Structure for an asymmetric single order low pass IIR filter
*/
typedef struct IirAsymLowPass
{
  IBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float raising_ratio;   //!< ratio applied when input higher than our last_output
  float lowering_ratio;    //!< ratio applied when input lower than our last_output
  fc_PTYPE last_output;
} IirAsymLowPass;


void IirAsymLowPass_ctor(IirAsymLowPass* block);
IirAsymLowPass* IirAsymLowPass_new(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio);
IBlock* IirAsymLowPass_new_iblock(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio);


/**
 * Class method.
 * Use to check if an IBlock is a IirAsymLowPass block.
 */
bool IirAsymLowPass_Test_type(void* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAsymLowPass_preload(void* self, fc_PTYPE input);
fc_PTYPE IirAsymLowPass_step(void* self, fc_PTYPE input);




//#########################################################################################################
// Unit testing stuff
//#########################################################################################################

//The following methods are useful for unit testing using generic C++ code.
//THESE functions must be static because they are defined in a header
#if defined(__cplusplus) && defined(fc_UNIT_TESTING)
extern "C++" {

#ifndef _fc_CPP_TEST_IIR_ASYM_LOW_PASS_INCLUDE_GUARD
#define _fc_CPP_TEST_IIR_ASYM_LOW_PASS_INCLUDE_GUARD
  template <typename BlockType>
  static BlockType* CppIirAsymLowPass_new(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio);

  template <typename BlockType>
  static BlockType* CppIirAsymLowPass_new_iblock(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio);
#endif


  template <>
  static IirAsymLowPass* CppIirAsymLowPass_new<IirAsymLowPass>(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio) {
    return IirAsymLowPass_new(bc, raising_ratio, lowering_ratio);
  }

  template <>
  static IirAsymLowPass* CppIirAsymLowPass_new_iblock<IirAsymLowPass>(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio) {
    return (IirAsymLowPass*)IirAsymLowPass_new_iblock(bc, raising_ratio, lowering_ratio);
  }


  #define CppHelperFilterType     IirAsymLowPass
  #include "fc_lib/templates/fc_cpp_helper.ipp"
}

#endif