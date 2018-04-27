

#define IirAccelAsymLowPass               FC_MAKE_NAME(IirAccelAsymLowPass)
#define IirAccelAsymLowPass_ctor          FC_MAKE_NAME(IirAccelAsymLowPass_ctor)
#define IirAccelAsymLowPass_new           FC_MAKE_NAME(IirAccelAsymLowPass_new)
#define IirAccelAsymLowPass_new_iblock    FC_MAKE_NAME(IirAccelAsymLowPass_new_iblock)
#define IirAccelAsymLowPass_step          FC_MAKE_NAME(IirAccelAsymLowPass_step)
#define IirAccelAsymLowPass_preload       FC_MAKE_NAME(IirAccelAsymLowPass_preload)

#define IirAccelAsymLowPass_Test_type     FC_MAKE_NAME(IirAccelAsymLowPass_Test_type)


/**
 * Structure for an accelerated asymmetric single order low pass IIR filter
 * 
 */
typedef struct IirAccelAsymLowPass
{
  IBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  bool rise_faster;
  float fast_ratio;
  float slow_ratio;
  float accelerated_slow_ratio;
  fc_PTYPE last_output;
} IirAccelAsymLowPass;


void IirAccelAsymLowPass_ctor(IirAccelAsymLowPass* block);
IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio);
IBlock* IirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio);

/**
 * Class method.
 * Use to check if an IBlock is a IirAccelAsymLowPass block.
 */
bool IirAccelAsymLowPass_Test_type(void* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAccelAsymLowPass_preload(void* self, fc_PTYPE input);
fc_PTYPE IirAccelAsymLowPass_step(void* self, fc_PTYPE input);




//#########################################################################################################
// Unit testing stuff
//#########################################################################################################

//The following methods are useful for unit testing using generic C++ code.
//THESE functions must be static because they are defined in a header
#if defined(__cplusplus) && defined(fc_UNIT_TESTING)
extern "C++" {

#ifndef _fc_CPP_TEST_IIR_ACCEL_ASYM_LOW_PASS_INCLUDE_GUARD
#define _fc_CPP_TEST_IIR_ACCEL_ASYM_LOW_PASS_INCLUDE_GUARD
  template <typename BlockType>
  static BlockType* CppIirAccelAsymLowPass_new(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio);

  template <typename BlockType>
  static BlockType* CppIirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio);
#endif


  template <>
  static IirAccelAsymLowPass* CppIirAccelAsymLowPass_new<IirAccelAsymLowPass>(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio) {
    return IirAccelAsymLowPass_new(bc, rise_faster, fast_ratio, slow_ratio);
  }

  template <>
  static IirAccelAsymLowPass* CppIirAccelAsymLowPass_new_iblock<IirAccelAsymLowPass>(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio) {
    return (IirAccelAsymLowPass*)IirAccelAsymLowPass_new_iblock(bc, rise_faster, fast_ratio, slow_ratio);
  }


  #define CppHelperFilterType     IirAccelAsymLowPass
  #include "fc_lib/templates/fc_cpp_helper.ipp"
}

#endif
