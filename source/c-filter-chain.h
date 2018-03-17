//can't do #pragma once; as we need to be able to define multiple different types

#include <stdint.h>
#include <stdbool.h>

#define fc_Type FILTER_CHAIN_TYPE

#define ECAT1(arg_1, arg_2)    arg_1 ## arg_2
#define ECAT2(arg_1, arg_2)    ECAT1(arg_1, arg_2)
#define ECAT3(arg_1, arg_2)    ECAT2(arg_1, arg_2)
#define ECAT4(arg_1, arg_2)    ECAT3(arg_1, arg_2)
#define ECAT5(arg_1, arg_2)    ECAT4(arg_1, arg_2)
#define ECAT6(arg_1, arg_2)    ECAT5(arg_1, arg_2)
#define ECAT7(arg_1, arg_2)    ECAT6(arg_1, arg_2)
#define ECAT8(arg_1, arg_2)    ECAT7(arg_1, arg_2)
#define ECAT(arg_1, arg_2)     ECAT8(arg_1, arg_2)


#define GenericBlock ECAT(fcb_GenericBlock_, fc_Type)
#define GenericBlock_filter_t ECAT(fcb_GenericBlock_filter_t, fc_Type)
#define GenericBlock_setup_t ECAT(fcb_GenericBlock_setup_t, fc_Type)


//need to forward declare GenericBlock for other declarations.
typedef struct GenericBlock GenericBlock;

typedef void(*GenericBlock_filter_t)(GenericBlock* block, fc_Type input);
typedef void(*GenericBlock_setup_t)(GenericBlock* block);

 

#define BlockFunctionTable ECAT(fc_BlockFunctionTable_, fc_Type)
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




#define FilterChain ECAT(fc_FilterChain_, fc_Type)
#define FilterChain_setup    ECAT(fc_FilterChain_setup_, fc_Type)
#define FilterChain_filter    ECAT(fc_FilterChain_filter_, fc_Type)

typedef struct FilterChain
{
  GenericBlock **blocks; //!< array of pointers to blocks
  uint16_t block_count;
} FilterChain;

void FilterChain_setup(FilterChain* fc);
fc_Type FilterChain_filter(FilterChain* fc, fc_Type input);




#define PassThrough ECAT(fcb_PassThroughBlock_, fc_Type)
#define PassThrough_new    ECAT(fcb_PassThroughBlock_new_, fc_Type)
#define PassThrough_filter ECAT(fcb_PassThroughBlock_filter_, fc_Type)
#define PassThrough_setup  ECAT(fcb_PassThroughBlock_setup_, fc_Type)


typedef struct PassThrough
{
  GenericBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
} PassThrough;


void PassThrough_new(PassThrough* block);
void PassThrough_filter(PassThrough* block, fc_Type input);
void PassThrough_setup(PassThrough* block);







#define IirLowPass1 ECAT(fcb_IirLowPass1_, fc_Type)
#define IirLowPass1_new ECAT(fcb_IirLowPass1_new_, fc_Type)
#define IirLowPass1_filter ECAT(fcb_IirLowPass1_filter_, fc_Type)
#define IirLowPass1_setup ECAT(fcb_IirLowPass1_setup_, fc_Type)


/**
 * Structure for a single order low pass IIR filter
 */
typedef struct IirLowPass1
{
  GenericBlock block;  //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  float new_ratio;
} IirLowPass1;


void IirLowPass1_new(IirLowPass1* block);
void IirLowPass1_filter(IirLowPass1* block, fc_Type input);
void IirLowPass1_setup(IirLowPass1* block);



