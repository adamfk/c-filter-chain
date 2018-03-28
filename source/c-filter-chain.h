//can't do #pragma once; as we need to be able to define multiple different types

/*
  Requires C99 compiler

  Either use all statically allocated objects, or all dyanically allocated objects.
  This allows the destruct function to be called on all in a filter chain safely.

*/

#include <stdint.h>
#include <stdbool.h>
#include "user-stuff.h"
#include "c-filter-chain-common.h"


#ifdef __cplusplus
#  define LIST_START(prefix) &vector<fcb ## prefix ## _GenericBlock*> {
#  define LIST_END  NULL, }[0]
#else
#  define LIST_START(prefix) (fcb## prefix ## _GenericBlock*[]) { //starts a compound literal
#  define LIST_END  NULL, }
#endif




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

typedef fc_Type(*GenericBlock_filter_t)(GenericBlock* block, fc_Type input);
typedef void(*GenericBlock_setup_t)(GenericBlock* block);
typedef void(*GenericBlock_destruct_t)(fc_AbstractAllocator const * allocator, GenericBlock* block);

 

#define BlockFunctionTable FC_MAKE_NAME(BlockFunctionTable)
typedef struct BlockFunctionTable
{
  GenericBlock_filter_t filter;
  GenericBlock_setup_t setup;
  GenericBlock_destruct_t destruct; //!< Only `GenericBlock_destruct( )` should call as allowed to be NULL for default freeing of block.
} BlockFunctionTable;


/**
 * Generic Filter Chain Block structure
 */
struct GenericBlock
{
  BlockFunctionTable const * function_table;
};




#define FilterChain                  FC_MAKE_NAME(FilterChain)
#define FilterChain_ctor             FC_MAKE_NAME(FilterChain_setup)
#define FilterChain_setup            FC_MAKE_NAME(FilterChain_setup)
#define FilterChain_filter           FC_MAKE_NAME(FilterChain_filter)
#define FilterChain_new              FC_MAKE_NAME(FilterChain_new)
#define FilterChain_allocate_fields  FC_MAKE_NAME(FilterChain_allocate_fields)
#define FilterChain_destruct         FC_MAKE_NAME(FilterChain_destruct)


//TODOLOW create a convenience class AllocatedBlock that combines an allocator and a single block.
//Would save you the overhead of creating another FilterChain just to use a single block from a different allocation.


/**
 * Assumes same allocation method for both FilterChain and `blocks` field.
 * 
 * All directly contained blocks of a FilterChain must have the same allocation as the FilterChain unless they are FilterChain.
 * Said another way, all blocks other a FilterChain (or FilterChain subclass) must have the same allocation as the enclosing FilterChain.
 * This allows knowing how to destroy each block without storing an allocator reference in each block. It also allows mixing and matching
 * allocations as long as the above rule is used.
 * TODO: write tests for above
 * 
 * TODO look into ways of detecting that all contained blocks follow above rule. It needs to be c code for detection as it
 * would be a runtime method available to the user to check their setup.
 *   Could potentially create another virtual method called `get_allocated_size(self, allocator)` that would return the number of bytes
 *   that would have been allocated from the specified allocator. User could potentially inspect allocator's actual used bytes
 *   and compare against what `get_allocated_size()` returned.
 */
typedef struct FilterChain
{
  GenericBlock block;    //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE

  /**
   * Allows passing destructor to contained blocks.
   */
  const fc_BuilderConfig* builder_config;
  GenericBlock **blocks; //!< array of pointers to blocks. DO NOT manually adjust if auto allocated via "new()" methods.
  uint16_t block_count;
} FilterChain;

void FilterChain_setup(FilterChain* fc);

void FilterChain_ctor(FilterChain* filter_chain);
FilterChain* FilterChain_new(fc_BuilderConfig* bc, GenericBlock** block_list);
bool FilterChain_allocate_fields(fc_BuilderConfig* bc, FilterChain* filter_chain, GenericBlock** block_list);
void FilterChain_destruct(fc_AbstractAllocator const * allocator, FilterChain* fc);
fc_Type FilterChain_filter(FilterChain* fc, fc_Type input);


//###################################################################33



#define PassThrough             FCB_MAKE_NAME(PassThrough)
#define PassThrough_ctor         FCB_MAKE_NAME(PassThrough_ctor)
#define PassThrough_new  FCB_MAKE_NAME(PassThrough_new)
#define PassThrough_filter      FCB_MAKE_NAME(PassThrough_filter)
#define PassThrough_setup       FCB_MAKE_NAME(PassThrough_setup)


typedef struct PassThrough
{
  GenericBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
} PassThrough;


void PassThrough_ctor(PassThrough* block);
PassThrough* PassThrough_new(fc_BuilderConfig* bc);
void PassThrough_setup(PassThrough* block);
fc_Type PassThrough_filter(PassThrough* block, fc_Type input);



//###################################################################33




#define IirLowPass1               FCB_MAKE_NAME(IirLowPass1)
#define IirLowPass1_ctor           FCB_MAKE_NAME(IirLowPass1_ctor)
#define IirLowPass1_new    FCB_MAKE_NAME(IirLowPass1_new)
#define IirLowPass1_new_gb FCB_MAKE_NAME(IirLowPass1_new_gb)
#define IirLowPass1_filter        FCB_MAKE_NAME(IirLowPass1_filter)
#define IirLowPass1_setup         FCB_MAKE_NAME(IirLowPass1_setup)

/**
 * Structure for a single order low pass IIR filter
 */
typedef struct IirLowPass1
{
  GenericBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float new_ratio;
  fc_Type last_output;
} IirLowPass1;


void IirLowPass1_ctor(IirLowPass1* block);
IirLowPass1* IirLowPass1_new(fc_BuilderConfig* bc, float new_ratio);
GenericBlock* IirLowPass1_new_gb(fc_BuilderConfig* bc, float new_ratio);
void IirLowPass1_setup(IirLowPass1* block);
fc_Type IirLowPass1_filter(IirLowPass1* block, fc_Type input);


//###################################################################33


#define DownSampler               FCB_MAKE_NAME(DownSampler)
#define DownSampler_ctor           FCB_MAKE_NAME(DownSampler_ctor)
#define DownSampler_new    FCB_MAKE_NAME(DownSampler_new)
#define DownSampler_new_gb FCB_MAKE_NAME(DownSampler_new_gb)
#define DownSampler_filter        FCB_MAKE_NAME(DownSampler_filter)
#define DownSampler_setup         FCB_MAKE_NAME(DownSampler_setup)

#define fc_Extends(field_declaration) field_declaration;

/**
* Structure a down sampler block.
* EXTENDS FilterChain.
*/
typedef struct DownSampler
{
  FilterChain base_fc_instance;   //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  uint16_t sample_every_x; //!< How often to sample input. If 1, it will sample every input. One based!
  uint16_t sample_count;   //!< When this counts up to #sample_every_x, it will sample and reset count
  fc_Type latched_output;  //!< keeps outputting the same value between downsamples
} DownSampler;



void DownSampler_ctor(DownSampler* block);
DownSampler* DownSampler_new(fc_BuilderConfig* bc, uint16_t sample_offset, uint16_t sample_every_x, GenericBlock** block_list);
GenericBlock* DownSampler_new_gb(fc_BuilderConfig* bc, uint16_t sample_offset, uint16_t sample_every_x, GenericBlock** block_list);
void DownSampler_setup(DownSampler* block);
fc_Type DownSampler_filter(DownSampler* block, fc_Type input);




#ifdef __cplusplus
}
#endif
