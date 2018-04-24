


#define Delay             FC_MAKE_NAME(Delay)
#define Delay_ctor         FC_MAKE_NAME(Delay_ctor)
#define Delay_new  FC_MAKE_NAME(Delay_new)
#define Delay_destruct_fields  FC_MAKE_NAME(Delay_destruct_fields)
#define Delay_step      FC_MAKE_NAME(Delay_step)
#define Delay_preload       FC_MAKE_NAME(Delay_preload)

#define Delay_Test_type        FC_MAKE_NAME(Delay_Test_type)


typedef struct Delay
{
  IBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  uint16_t saved_sample_length;
  fc_Type* previous_samples; //!< index zero is most recent
} Delay;


void Delay_ctor(Delay* block);
Delay* Delay_new(fc_BuildCtx* bc, uint16_t history_depth);

/**
 * Class method.
 * Use to check if an IBlock is a Delay block.
 */
bool Delay_Test_type(IBlock* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void Delay_destruct_fields(void* self, fc_IAllocator const * allocator);
void Delay_preload(void* self, fc_Type input);
fc_Type Delay_step(void* self, fc_Type input);


