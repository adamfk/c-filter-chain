//can't do #pragma once; as we need to be able to define multiple different types

/*
  Requires C99 compiler

  Either use all statically allocated objects, or all dyanically allocated objects.
  This allows the destruct function to be called on all in a filter chain safely.

*/

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * This is a special pointer value to indicate an allocation failure.
 * The lib uses NULL to terminate lists and needs this special pointer
 * value to be able to detect a nested allocation failure.
 */
extern void const * const CF_ALLOCATE_FAIL_PTR;

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

#define GenericBlock             FCB_MAKE_NAME(GenericBlock)
#define GenericBlock_filter_t    FCB_MAKE_NAME(GenericBlock_filter_t)
#define GenericBlock_setup_t     FCB_MAKE_NAME(GenericBlock_setup_t)
#define GenericBlock_destruct_t  FCB_MAKE_NAME(GenericBlock_destruct_t)


//need to forward declare GenericBlock for other declarations.
typedef struct GenericBlock GenericBlock;

typedef void(*GenericBlock_filter_t)(GenericBlock* block, fc_Type input);
typedef void(*GenericBlock_setup_t)(GenericBlock* block);
typedef void(*GenericBlock_destruct_t)(GenericBlock* block);

 

#define BlockFunctionTable FC_MAKE_NAME(BlockFunctionTable)
typedef struct BlockFunctionTable
{
  GenericBlock_filter_t filter;
  GenericBlock_setup_t setup;
  GenericBlock_destruct_t destruct; //!< all subclasses must define this
} BlockFunctionTable;


/**
 * Generic Filter Chain Block structure
 */
struct GenericBlock
{
  BlockFunctionTable const * function_table;
  fc_Type output;
};




#define FilterChain                FC_MAKE_NAME(FilterChain)
#define FilterChain_setup          FC_MAKE_NAME(FilterChain_setup)
#define FilterChain_filter         FC_MAKE_NAME(FilterChain_filter)
#define FilterChain_malloc         FC_MAKE_NAME(FilterChain_malloc)
#define FilterChain_malloc_inner   FC_MAKE_NAME(FilterChain_malloc_inner)
#define FilterChain_destruct       FC_MAKE_NAME(FilterChain_destruct)
#define FilterChain_destruct_inner FC_MAKE_NAME(FilterChain_destruct_inner)


typedef struct FilterChain
{
  GenericBlock **blocks; //!< array of pointers to blocks
  uint16_t block_count;
} FilterChain;

void FilterChain_setup(FilterChain* fc);

/**
 * varargs MUST BE NULL TERMINATED!
 */
FilterChain* FilterChain_malloc(uint8_t dummy, ...);
bool FilterChain_malloc_inner(FilterChain* filter_chain, va_list block_list);
void FilterChain_destruct(FilterChain* fc);
void FilterChain_destruct_inner(FilterChain* fc);
fc_Type FilterChain_filter(FilterChain* fc, fc_Type input);


//###################################################################33



#define PassThrough             FCB_MAKE_NAME(PassThrough)
#define PassThrough_new         FCB_MAKE_NAME(PassThrough_new)
#define PassThrough_new_malloc  FCB_MAKE_NAME(PassThrough_new_malloc)
#define PassThrough_destruct    FCB_MAKE_NAME(PassThrough_destruct)
#define PassThrough_filter      FCB_MAKE_NAME(PassThrough_filter)
#define PassThrough_setup       FCB_MAKE_NAME(PassThrough_setup)


typedef struct PassThrough
{
  GenericBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
} PassThrough;


void PassThrough_new(PassThrough* block);
PassThrough* PassThrough_new_malloc();
void PassThrough_destruct(PassThrough* block);
void PassThrough_setup(PassThrough* block);
void PassThrough_filter(PassThrough* block, fc_Type input);



//###################################################################33




#define IirLowPass1             FCB_MAKE_NAME(IirLowPass1)
#define IirLowPass1_new         FCB_MAKE_NAME(IirLowPass1_new)
#define IirLowPass1_new_malloc  FCB_MAKE_NAME(IirLowPass1_new_malloc)
#define IirLowPass1_destruct    FCB_MAKE_NAME(IirLowPass1_destruct)
#define IirLowPass1_filter      FCB_MAKE_NAME(IirLowPass1_filter)
#define IirLowPass1_setup       FCB_MAKE_NAME(IirLowPass1_setup)

/**
 * Structure for a single order low pass IIR filter
 */
typedef struct IirLowPass1
{
  GenericBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float new_ratio;
} IirLowPass1;


void IirLowPass1_new(IirLowPass1* block);
IirLowPass1* IirLowPass1_new_malloc(float new_ratio);
void IirLowPass1_destruct(IirLowPass1* block);
void IirLowPass1_setup(IirLowPass1* block);
void IirLowPass1_filter(IirLowPass1* block, fc_Type input);


//###################################################################33


#define DownSampler            FCB_MAKE_NAME(DownSampler)
#define DownSampler_new        FCB_MAKE_NAME(DownSampler_new)
#define DownSampler_new_malloc FCB_MAKE_NAME(DownSampler_new_malloc)
#define DownSampler_destruct   FCB_MAKE_NAME(DownSampler_destruct)
#define DownSampler_filter     FCB_MAKE_NAME(DownSampler_filter)
#define DownSampler_setup      FCB_MAKE_NAME(DownSampler_setup)


/**
* Structure a down sampler block
*/
typedef struct DownSampler
{
  GenericBlock block;      //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  FilterChain sub_chain;   //!< the filter chain that receives the downsampled input to this block
  uint16_t sample_every_x; //!< How often to sample input. If 1, it will sample every input. One based!
  uint16_t sample_count;   //!< When this counts up to #sample_every_x, it will sample and reset count
} DownSampler;


void DownSampler_new(DownSampler* block);
DownSampler* DownSampler_new_malloc(uint16_t sample_offset, uint16_t sample_every_x, ...);
void DownSampler_setup(DownSampler* block);
void DownSampler_filter(DownSampler* block, fc_Type input);
void DownSampler_destruct(DownSampler* block);




#ifdef __cplusplus
}
#endif
