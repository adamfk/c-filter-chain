

#define IirAccelAsymLowPass               FC_MAKE_NAME(IirAccelAsymLowPass)
#define IirAccelAsymLowPass_ctor          FC_MAKE_NAME(IirAccelAsymLowPass_ctor)
#define IirAccelAsymLowPass_new           FC_MAKE_NAME(IirAccelAsymLowPass_new)
#define IirAccelAsymLowPass_new_iblock    FC_MAKE_NAME(IirAccelAsymLowPass_new_iblock)
#define IirAccelAsymLowPass_step          FC_MAKE_NAME(IirAccelAsymLowPass_step)
#define IirAccelAsymLowPass_preload       FC_MAKE_NAME(IirAccelAsymLowPass_preload)

#define IirAccelAsymLowPass_Test_type     FC_MAKE_NAME(IirAccelAsymLowPass_Test_type)


/**
 * Structure for an asymmetric single order low pass IIR filter
 */
typedef struct IirAccelAsymLowPass
{
  IBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float raising_ratio;   //!< IIR ratio applied when input higher than `last_output`
  float lowering_ratio;    //!< IIR ratio applied when input lower than `last_output`
  float cur_raising_ratio;   //!< current IIR ratio applied when input higher than `last_output`
  float cur_lowering_ratio;    //!< current IIR ratio applied when input lower than `last_output`
  //TODO consolidate `cur_raising_ratio` and `cur_lowering_ratio` into one field as we only need a single `cur_accelerated_ratio`
  fc_PTYPE last_output;
} IirAccelAsymLowPass;


void IirAccelAsymLowPass_ctor(IirAccelAsymLowPass* block);
IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio);
IBlock* IirAccelAsymLowPass_new_iblock(fc_BuildCtx* bc, float raising_ratio, float lowering_ratio);

/**
 * Class method.
 * Use to check if an IBlock is a IirAccelAsymLowPass block.
 */
bool IirAccelAsymLowPass_Test_type(IBlock* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAccelAsymLowPass_preload(void* self, fc_PTYPE input);
fc_PTYPE IirAccelAsymLowPass_step(void* self, fc_PTYPE input);


