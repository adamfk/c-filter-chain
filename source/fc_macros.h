#pragma once

#define fc_ZERO_STRUCT(my_struct)  memset(&(my_struct), 0, sizeof(my_struct));


/**
 * Macro for getting the size of an array that is known at compile time. Code from Google's Chromium project.
 * Taken from http://stackoverflow.com/questions/4415524/common-array-length-macro-for-c
 *
 * Helps guard against taking the size of a pointer to an array and some other C++ stuff;
 */
#define fc_COUNTOF(x) ((sizeof(x)/sizeof(0[x])) / ((size_t)(!(sizeof(x) % sizeof(0[x])))))


#define ENSURE_NOT_LOWER_THAN(var, min)  if((var)<(min)){ var = min;}
#define ENSURE_NOT_HIGHER_THAN(var, max) if((var)>(max)){ var = max;}
#define ENSURE_BETWEEN(min, var, max) ENSURE_NOT_LOWER_THAN(var, min); ENSURE_NOT_HIGHER_THAN(var, max)



#undef fc_BEGIN_C_DECLS
#undef fc_END_C_DECLS
#ifdef __cplusplus
#  define fc_BEGIN_C_DECLS extern "C" {
#  define fc_END_C_DECLS }
#else
#  define fc_BEGIN_C_DECLS
#  define fc_END_C_DECLS
#endif

