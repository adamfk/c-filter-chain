//can't do #pragma once; as we need to be able to define multiple different types

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define fc_Type FILTER_CHAIN_TYPE

//expand macro and concatenate
#define ECAT1(arg_1, arg_2, arg_3, arg_4)    arg_1 ## arg_2 ## arg_3 ## arg_4
#define ECAT2(arg_1, arg_2, arg_3, arg_4)    ECAT1(arg_1, arg_2, arg_3, arg_4)
#define ECAT3(arg_1, arg_2, arg_3, arg_4)    ECAT2(arg_1, arg_2, arg_3, arg_4)
#define ECAT4(arg_1, arg_2, arg_3, arg_4)    ECAT3(arg_1, arg_2, arg_3, arg_4)
#define ECAT5(arg_1, arg_2, arg_3, arg_4)    ECAT4(arg_1, arg_2, arg_3, arg_4)
#define ECAT6(arg_1, arg_2, arg_3, arg_4)    ECAT5(arg_1, arg_2, arg_3, arg_4)
#define ECAT7(arg_1, arg_2, arg_3, arg_4)    ECAT6(arg_1, arg_2, arg_3, arg_4)
#define ECAT8(arg_1, arg_2, arg_3, arg_4)    ECAT7(arg_1, arg_2, arg_3, arg_4)
#define ECAT( arg_1, arg_2, arg_3, arg_4)    ECAT8(arg_1, arg_2, arg_3, arg_4)


#define FC_MAKE_NAME(name) ECAT(fc, FILTER_CHAIN_NAME_PREFIX, _, name)
#define FCB_MAKE_NAME(name) ECAT(fcb, FILTER_CHAIN_NAME_PREFIX, _, name)

#define GenericBlock          FCB_MAKE_NAME(GenericBlock)
#define GenericBlock_filter_t FCB_MAKE_NAME(GenericBlock_filter_t)
#define GenericBlock_setup_t  FCB_MAKE_NAME(GenericBlock_setup_t)


//need to forward declare GenericBlock for other declarations.
typedef struct GenericBlock GenericBlock;

typedef void(*GenericBlock_filter_t)(GenericBlock* block, fc_Type input);
typedef void(*GenericBlock_setup_t)(GenericBlock* block);

 

#define BlockFunctionTable FC_MAKE_NAME(BlockFunctionTable)
typedef struct BlockFunctionTable
{
  GenericBlock_filter_t filter;
  GenericBlock_setup_t setup;
} BlockFunctionTable;


/**
 * Generic Filter Chain Block structure
 */
struct GenericBlock
{
  BlockFunctionTable const * function_table;
  fc_Type output;
};




#define FilterChain         FC_MAKE_NAME(FilterChain)
#define FilterChain_setup   FC_MAKE_NAME(FilterChain_setup)
#define FilterChain_filter  FC_MAKE_NAME(FilterChain_filter)

typedef struct FilterChain
{
  GenericBlock **blocks; //!< array of pointers to blocks
  uint16_t block_count;
} FilterChain;

void FilterChain_setup(FilterChain* fc);
fc_Type FilterChain_filter(FilterChain* fc, fc_Type input);




#define PassThrough        FCB_MAKE_NAME(PassThrough)
#define PassThrough_new    FCB_MAKE_NAME(PassThrough_new)
#define PassThrough_filter FCB_MAKE_NAME(PassThrough_filter)
#define PassThrough_setup  FCB_MAKE_NAME(PassThrough_setup)


typedef struct PassThrough
{
  GenericBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
} PassThrough;


void PassThrough_new(PassThrough* block);
void PassThrough_setup(PassThrough* block);
void PassThrough_filter(PassThrough* block, fc_Type input);







#define IirLowPass1        FCB_MAKE_NAME(IirLowPass1)
#define IirLowPass1_new    FCB_MAKE_NAME(IirLowPass1_new)
#define IirLowPass1_filter FCB_MAKE_NAME(IirLowPass1_filter)
#define IirLowPass1_setup  FCB_MAKE_NAME(IirLowPass1_setup)


/**
 * Structure for a single order low pass IIR filter
 */
typedef struct IirLowPass1
{
  GenericBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float new_ratio;
} IirLowPass1;


void IirLowPass1_new(IirLowPass1* block);
void IirLowPass1_setup(IirLowPass1* block);
void IirLowPass1_filter(IirLowPass1* block, fc_Type input);





#define DownSampler        FCB_MAKE_NAME(DownSampler)
#define DownSampler_new    FCB_MAKE_NAME(DownSampler_new)
#define DownSampler_filter FCB_MAKE_NAME(DownSampler_filter)
#define DownSampler_setup  FCB_MAKE_NAME(DownSampler_setup)


/**
* Structure for a single order low pass IIR filter
*/
typedef struct DownSampler
{
  GenericBlock block;      //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  FilterChain sub_chain;   //!< the filter chain that receives the downsampled input to this block
  uint16_t sample_every_x; //!< How often to sample input. If 1, it will sample every input. One based!
  uint16_t sample_count;   //!< When this counts up to #sample_every_x, it will sample and reset count
} DownSampler;


void DownSampler_new(DownSampler* block);
void DownSampler_setup(DownSampler* block);
void DownSampler_filter(DownSampler* block, fc_Type input);




#ifdef __cplusplus
}
#endif
