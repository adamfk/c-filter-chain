//can't do `#pragma once` or include guard as we need to be able to define multiple different types

/*
  Requires C99 compiler

  Either use all statically allocated objects, or all dyanically allocated objects.
  This allows the destruct function to be called on all in a filter chain safely.

*/

#include <stdint.h>
#include <stdbool.h>
#include "fc_default_config.h"
#include "fc_common.h"
#include "fc_macros.h"
#include "fc_IVisitor.h"
#include "fc_WorkingBuffer.h"


#ifdef __cplusplus
//NOTE! You must `#include <vector>` for this to work
#  define LIST_START(prefix) &std::vector<fc ## prefix ## _IBlock*> {
#  define LIST_END  NULL, }[0]
#else
#  define LIST_START(prefix) (fc## prefix ## _IBlock*[]) { //starts a compound literal
#  define LIST_END  NULL, }
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


//###############################################################


#ifdef fc_UNIT_TESTING
#include "test_helper.h"
#endif


fc_BEGIN_C_DECLS

#include "fc_IBlock.h"
#include "fc_BlockChain.h"
#include "fc_Delay.h"
#include "fc_Median.h"
#include "fc_IirAsymLowPass.h"
#include "fc_IirAccelAsymLowPass.h"
#include "fc_DownSampler.h"
#include "fc_IirLowPass.h"

#include "fc_PassThrough.h"


fc_END_C_DECLS