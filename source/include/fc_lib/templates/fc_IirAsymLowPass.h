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
  float higher_ratio;   //!< ratio applied when input higher than our last_output
  float lower_ratio;    //!< ratio applied when input lower than our last_output
  fc_Type last_output;
} IirAsymLowPass;


void IirAsymLowPass_ctor(IirAsymLowPass* block);
IirAsymLowPass* IirAsymLowPass_new(fc_BuildCtx* bc, float higher_ratio, float lower_ratio);
IBlock* IirAsymLowPass_new_iblock(fc_BuildCtx* bc, float higher_ratio, float lower_ratio);


/**
 * Class method.
 * Use to check if an IBlock is a IirAsymLowPass block.
 */
bool IirAsymLowPass_Test_type(void* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirAsymLowPass_preload(void* self, fc_Type input);
fc_Type IirAsymLowPass_step(void* self, fc_Type input);



