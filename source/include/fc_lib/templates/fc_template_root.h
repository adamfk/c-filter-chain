//can't do `#pragma once` or include guard as we need to be able to define multiple different types

/*
  Requires C99 compiler

  Either use all statically allocated objects, or all dyanically allocated objects.
  This allows the destruct function to be called on all in a filter chain safely.

*/

#include <stdint.h>
#include <stdbool.h>

#include "fc_default_config.h"  //TODO: decide if that should be in here or in each type file like "fc32_lib.h"

#include "fc_lib/fc_common.h"
#include "fc_lib/fc_macros.h"
#include "fc_lib/fc_IVisitor.h"
#include "fc_lib/fc_WorkingBuffer.h"


#ifdef __cplusplus
//NOTE! You must `#include <vector>` for this to work
#  define LIST_START(prefix) &std::vector<fc ## prefix ## _IBlock*> {
#  define LIST_END  NULL, }[0]
#else
#  define LIST_START(prefix) (fc## prefix ## _IBlock*[]) { //starts a compound literal
#  define LIST_END  NULL, }
#endif



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


#define FC_MAKE_NAME(name) ECAT(fc, fc_LIB_PREFIX, _, name)



#define _fc_int8_t_IS_SIGNED   true
#define _fc_int16_t_IS_SIGNED  true
#define _fc_int32_t_IS_SIGNED  true
#define _fc_int64_t_IS_SIGNED  true
#define _fc_uint8_t_IS_SIGNED  false
#define _fc_uint16_t_IS_SIGNED false
#define _fc_uint32_t_IS_SIGNED false
#define _fc_uint64_t_IS_SIGNED false
#define _fc_float_IS_SIGNED  true
#define _fc_double_IS_SIGNED true

#define _fc_int8_t_IS_FLOATING_PT   false
#define _fc_int16_t_IS_FLOATING_PT  false
#define _fc_int32_t_IS_FLOATING_PT  false
#define _fc_int64_t_IS_FLOATING_PT  false
#define _fc_uint8_t_IS_FLOATING_PT  false
#define _fc_uint16_t_IS_FLOATING_PT false
#define _fc_uint32_t_IS_FLOATING_PT false
#define _fc_uint64_t_IS_FLOATING_PT false
#define _fc_float_IS_FLOATING_PT  true
#define _fc_double_IS_FLOATING_PT true

#define fc_PTYPE_IS_SIGNED        ECAT(_fc_, fc_PTYPE, _IS_SIGNED,)
#define fc_PTYPE_IS_FLOATING_PT   ECAT(_fc_, fc_PTYPE, _IS_FLOATING_PT,)
#define fc_PTYPE_IS_INGEGRAL      !fc_PTYPE_IS_FLOATING_PT


//###############################################################


#ifdef fc_UNIT_TESTING
#include "test_helper.h"
#endif


fc_BEGIN_C_DECLS

#include "fc_lib/templates/fc_IBlock.h"
#include "fc_lib/templates/fc_BlockChain.h"
#include "fc_lib/templates/fc_Delay.h"
#include "fc_lib/templates/fc_Median.h"
#include "fc_lib/templates/fc_IirAsymLowPass.h"
#include "fc_lib/templates/fc_IirAccelAsymLowPass.h"
#include "fc_lib/templates/fc_DownSampler.h"
#include "fc_lib/templates/fc_IirLowPass.h"

#include "fc_lib/templates/fc_PassThrough.h"


fc_END_C_DECLS