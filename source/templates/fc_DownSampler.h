
#define DownSampler               FC_MAKE_NAME(DownSampler)
#define DownSampler_ctor           FC_MAKE_NAME(DownSampler_ctor)
#define DownSampler_new    FC_MAKE_NAME(DownSampler_new)
#define DownSampler_new_iblock FC_MAKE_NAME(DownSampler_new_iblock)
#define DownSampler_step        FC_MAKE_NAME(DownSampler_step)
#define DownSampler_preload         FC_MAKE_NAME(DownSampler_preload)
#define DownSampler_cast_to_fc    FC_MAKE_NAME(DownSampler_cast_to_fc)
#define DownSampler_visit    FC_MAKE_NAME(DownSampler_visit)

#define DownSampler_Test_type        FC_MAKE_NAME(DownSampler_Test_type)



#define fc_Extends(field_declaration) field_declaration;

/**
* Structure a down sampler block.
* EXTENDS BlockChain.
*/
typedef struct DownSampler
{
  BlockChain base_fc_instance;   //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  uint16_t sample_every_x; //!< How often to sample input. If 1, it will sample every input. One based!
  uint16_t sample_count;   //!< When this counts up to #sample_every_x, it will sample and reset count
  fc_Type latched_output;  //!< keeps outputting the same value between downsamples
} DownSampler;



void DownSampler_ctor(DownSampler* block);
DownSampler* DownSampler_new(fc_Builder* bc, uint16_t sample_offset, uint16_t sample_every_x, IBlock** block_list);
IBlock* DownSampler_new_iblock(fc_Builder* bc, uint16_t sample_offset, uint16_t sample_every_x, IBlock** block_list);
void DownSampler_preload(DownSampler* block, fc_Type input);
fc_Type DownSampler_step(DownSampler* block, fc_Type input);
BlockChain* DownSampler_cast_to_fc(DownSampler* self);

/**
 * Class method.
 * Use to check if an IBlock is a DownSampler block.
 */
bool DownSampler_Test_type(IBlock* some_block);
