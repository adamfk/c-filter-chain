#pragma once

/*
  This file is included by all type libs like: fc8_lib.h, ... fc32_lib.h
  
  User code should create their own copy of this file and define the malloc/free functions.
  If no malloc or free is desired, then point them to dummy functions like:
    static void* do_nothing_malloc(size_t size){ (void)size; return NULL; }
    static void do_nothing_free(void* ptr){ (void)ptr; }
  
    #define fc_MALLOC_FUNC   do_nothing_malloc 
    #define fc_FREE_FUNC     do_nothing_free
    
  If using FreeRTOS, you may use something like:
    #define fc_MALLOC_FUNC   pvPortMalloc 
    #define fc_FREE_FUNC     vPortFree
*/


#define fc_MALLOC_FUNC   malloc 
#define fc_FREE_FUNC     free 

//User code should NOT include the below include for testing.
#include "test_config.h"
