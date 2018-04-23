
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
  fc_Type last_output;
} IirLowPass;


void IirLowPass_ctor(IirLowPass* block);
IirLowPass* IirLowPass_new(fc_Builder* bc, float new_ratio);
IBlock* IirLowPass_new_iblock(fc_Builder* bc, float new_ratio);

/**
 * Class method.
 * Use to check if an IBlock is a IirLowPass.
 */
bool IirLowPass_Test_type(IBlock* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void IirLowPass_preload(void* self, fc_Type input);
fc_Type IirLowPass_step(void* self, fc_Type input);
