#pragma once

#ifdef __cplusplus

//the following template allows us to determine the primitive type of a filter based on the filter's struct type.
//this is very useful for unit testing using generic types.
template <typename BlockType> 
struct FilterPrimitiveTypeSelector { 
  //nothing in here for default case which will cause a desired error.
};


template <typename BlockType>
static bool CppX_Test_type(void* some_iblock);


#endif