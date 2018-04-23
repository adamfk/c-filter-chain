

#define IirAccelAsymLowPass               FC_MAKE_NAME(IirAccelAsymLowPass)
#define IirAccelAsymLowPass_ctor           FC_MAKE_NAME(IirAccelAsymLowPass_ctor)
#define IirAccelAsymLowPass_new    FC_MAKE_NAME(IirAccelAsymLowPass_new)
#define IirAccelAsymLowPass_new_iblock FC_MAKE_NAME(IirAccelAsymLowPass_new_iblock)
#define IirAccelAsymLowPass_step        FC_MAKE_NAME(IirAccelAsymLowPass_step)
#define IirAccelAsymLowPass_preload         FC_MAKE_NAME(IirAccelAsymLowPass_preload)

#define IirAccelAsymLowPass_Test_type        FC_MAKE_NAME(IirAccelAsymLowPass_Test_type)


/**
 * Structure for an asymmetric single order low pass IIR filter
 */
typedef struct IirAccelAsymLowPass
{
  IBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float higher_ratio;   //!< ratio applied when input higher than our last_output
  float lower_ratio;    //!< ratio applied when input lower than our last_output
  float cur_higher_ratio;   //!< ratio applied when input higher than our last_output
  float cur_lower_ratio;    //!< ratio applied when input lower than our last_output
  fc_Type last_output;
} IirAccelAsymLowPass;


void IirAccelAsymLowPass_ctor(IirAccelAsymLowPass* block);
IirAccelAsymLowPass* IirAccelAsymLowPass_new(fc_Builder* bc, float higher_ratio, float lower_ratio);
IBlock* IirAccelAsymLowPass_new_iblock(fc_Builder* bc, float higher_ratio, float lower_ratio);
void IirAccelAsymLowPass_preload(IirAccelAsymLowPass* block, fc_Type input);
fc_Type IirAccelAsymLowPass_step(IirAccelAsymLowPass* block, fc_Type input);

/**
 * Class method.
 * Use to check if an IBlock is a IirAccelAsymLowPass block.
 */
bool IirAccelAsymLowPass_Test_type(IBlock* some_block);
