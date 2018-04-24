
#define Median             FC_MAKE_NAME(Median)
#define Median_ctor         FC_MAKE_NAME(Median_ctor)
#define Median_new  FC_MAKE_NAME(Median_new)
#define Median_new_iblock  FC_MAKE_NAME(Median_new_iblock)
#define Median_destruct_fields  FC_MAKE_NAME(Median_destruct_fields)
#define Median_step      FC_MAKE_NAME(Median_step)
#define Median_preload       FC_MAKE_NAME(Median_preload)

#define Median_Test_type     FC_MAKE_NAME(Median_Test_type)



typedef struct Median
{
  IBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  uint16_t saved_sample_length; //!< this is one less than the length of the filter
  fc_Type* previous_samples; //!< index zero is most recent
  fc_WorkingBuffer* working_buffer;
} Median;

//TODO put working buffer into to fc_BuildCtx?

void Median_ctor(Median* block);
Median* Median_new(fc_BuildCtx* bc, uint16_t length);
IBlock* Median_new_iblock(fc_BuildCtx* bc, uint16_t length);

/**
 * Class method.
 * Use to check if an IBlock is a Median block.
 */
bool Median_Test_type(void* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void Median_destruct_fields(void* self, fc_IAllocator const * allocator);
void Median_preload(void* self, fc_Type input);
fc_Type Median_step(void* self, fc_Type input);



//#########################################################################################################
// Unit testing stuff
//#########################################################################################################

//The following methods are useful for unit testing using generic C++ code.
//THESE functions must be static because they are defined in a header
#if defined(__cplusplus) && defined(fc_UNIT_TESTING)
extern "C++" {

#ifndef _fc_CPP_TEST_MEDIAN_INCLUDE_GUARD
#define _fc_CPP_TEST_MEDIAN_INCLUDE_GUARD
  template <typename BlockType>
  static BlockType* CppMedian_new(fc_BuildCtx* bc, uint16_t length);

  template <typename BlockType>
  static BlockType* CppMedian_new_iblock(fc_BuildCtx* bc, uint16_t length);
#endif


  template <>
  static Median* CppMedian_new<Median>(fc_BuildCtx* bc, uint16_t length) {
    return Median_new(bc, length);
  }

  template <>
  static Median* CppMedian_new_iblock<Median>(fc_BuildCtx* bc, uint16_t length) {
    return (Median*)Median_new_iblock(bc, length);
  }


  //TODO rename CppHelperFilterType to CppHelperBlockType
  #define CppHelperFilterType     Median
  #include "fc_lib/templates/fc_cpp_helper.ipp"
}

#endif