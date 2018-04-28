

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
  float slow_ratio_inc_percent; //!< 0.1f is 10%. 
  float slow_ratio_dec_percent; //!< 1.0f is 100%. See https://github.com/adamfk/c-filter-chain/issues/20 
  float accelerated_slow_ratio;
  fc_PTYPE last_output;
} IirAccelAsymLowPass;


void IirAccelAsymLowPass_ctor(IirAccelAsymLowPass* block);
IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent);
IBlock* IirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent);

//TODOLOW consider making a config struct type and constructor option. Then with C99, could specify using compound literal syntax.
/* ex: fc32_IirAccelAsymLowPass_new2(bc, (fc32_IAALP){ .rise_faster=true, .fast_ratio=1, .slow_ratio=0.1f, .slow_ratio_inc_percent=0.1f, .slow_ratio_dec_percent=0.25f });

*/

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
  static BlockType* CppIirAccelAsymLowPass_new(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent);

  template <typename BlockType>
  static BlockType* CppIirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent);
#endif


  template <>
  static IirAccelAsymLowPass* CppIirAccelAsymLowPass_new<IirAccelAsymLowPass>(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent) {
    return IirAccelAsymLowPass_new(bc, rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
  }

  template <>
  static IirAccelAsymLowPass* CppIirAccelAsymLowPass_new_iblock<IirAccelAsymLowPass>(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent) {
    return (IirAccelAsymLowPass*)IirAccelAsymLowPass_new_iblock(bc, rise_faster, fast_ratio, slow_ratio, slow_ratio_inc_percent, slow_ratio_dec_percent);
  }


  #define CppHelperFilterType     IirAccelAsymLowPass
  #include "fc_lib/templates/fc_cpp_helper.ipp"
}

#endif
