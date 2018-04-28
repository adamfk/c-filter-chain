

#define IirAccelAsymLowPass               FC_MAKE_NAME(IirAccelAsymLowPass)
#define IirAccelAsymLowPass_ctor          FC_MAKE_NAME(IirAccelAsymLowPass_ctor)
#define IirAccelAsymLowPass_new           FC_MAKE_NAME(IirAccelAsymLowPass_new)
#define IirAccelAsymLowPass_new_iblock    FC_MAKE_NAME(IirAccelAsymLowPass_new_iblock)
#define IirAccelAsymLowPass_step          FC_MAKE_NAME(IirAccelAsymLowPass_step)
#define IirAccelAsymLowPass_preload       FC_MAKE_NAME(IirAccelAsymLowPass_preload)

#define IirAccelAsymLowPass_Test_type     FC_MAKE_NAME(IirAccelAsymLowPass_Test_type)



/**
 * Structure for an accelerated asymmetric single order low pass IIR filter.
 * 
 * This filter is currently used for signal peak/valley envelopes that can follow a trendline.
 * A peak envelope filter will rise fast and fall slower. You can do this fine using a 
 * `IirAsymLowPass` filter if the signal has no downard trend. A peak envelope
 * implemented with a `IirAsymLowPass` filter running on even a straight downward line will
 * always lag behind by a certain amount. Then if you calc your signal envelope magnitude by 
 * taking the difference between peak and valley envelopes, it looks like the signal is noisey, 
 * but it is actually a straight line. To overcome this problem, a peak envelope filter 
 * implemented with a `IirAccelAsymLowPass` block will accelerate towards the input signal 
 * for every sample where the Block's output is above the input signal (the block's output needs
 * to fall which is done slowly). Conversely, every time the input signal exceeds the Block's
 * output, the filter rises quickly to match and also decreases the future acceleration towards
 * lower values. This works out quite well in practice as long as the values are chosen
 * carefully.
 */
typedef struct IirAccelAsymLowPass
{
  IBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  
  /**
   * If true:
   *   - this filter will RISE quickly using `fast_ratio` and fall slowly using `accelerated_slow_ratio`.
   *   - in "fast condition" when input >= `last_output`
   *   - in "slow condition" when input < `last_output`
   *   - useful for implementing a decaying "peak hold"
   * 
   * If false:
   *   - this filter will fall quickly using `fast_ratio` and RISE slowly using `accelerated_slow_ratio`.
   *   - in "fast condition" when input <= `last_output`
   *   - in "slow condition" when input > `last_output`
   *   - useful for implementing a decaying "valley hold"
   */
  bool rise_faster;

  /**
   * The IIR new_ratio used when in fast condition.
   * Recommend trying 1.0f.
   * Should be within [0.0, 1.0]. 
   */
  float fast_ratio;
  
  /**
   * The initial IIR new_ratio used when in slow condition.
   * Recommend trying 0.2f.
   * Should be within [0.0, 1.0] and <= `fast_ratio`.
   */
  float slow_ratio;
  
  /**
   * Percent to increase `accelerated_slow_ratio` each step while in slow condition. 
   * Recommend trying 0.1f (which is 10%).
   * Should be within [0.0, 1.0].
   * 
   * If this value is too large (around 30%), it will accelerate way too fast.
   */
  float slow_ratio_inc_percent;

  /**
   * Percent to decrease `accelerated_slow_ratio` each step while in fast condition. 
   * Recommend trying 0.2f (which is 20%).
   * Should be within [0.0, 1.0]
   * 
   * If this value is too large (around 40%), it will reset `accelerated_slow_ratio` 
   * to `slow_ratio` if it sees just a few small bumps which likely isn't ideal.
   * See https://github.com/adamfk/c-filter-chain/issues/20 for images.
   */
  float slow_ratio_dec_percent;

  /**
   * Don't modify. Used internally.
   * Bound within [`slow_ratio`, `fast_ratio`] range.
   * This is the IIR new_ratio that will be used when in slow condition.
   */
  float accelerated_slow_ratio;

  /**
   * Don't modify. Used internally.
   */
  fc_PTYPE last_output;
} IirAccelAsymLowPass;


//TODOLOW could consider variations to acceleration:
// - straight add/sub X to accelerated_slow_ratio. Ex: add 0.05




void IirAccelAsymLowPass_ctor(IirAccelAsymLowPass* block);
IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent);
IBlock* IirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, bool rise_faster, float fast_ratio, float slow_ratio, float slow_ratio_inc_percent, float slow_ratio_dec_percent);


//TODOLOW consider making a config struct type and constructor option. Then with C99, could specify using compound literal syntax.
//  ex: fc32_IirAccelAsymLowPass_new2(bc, (fc32_IAALP){ .rise_faster=true, .fast_ratio=1, .slow_ratio=0.1f, .slow_ratio_inc_percent=0.1f, .slow_ratio_dec_percent=0.25f });


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
