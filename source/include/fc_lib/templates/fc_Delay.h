


#define Delay                  FC_MAKE_NAME(Delay)
#define Delay_ctor             FC_MAKE_NAME(Delay_ctor)
#define Delay_new              FC_MAKE_NAME(Delay_new)
#define Delay_new_iblock       FC_MAKE_NAME(Delay_new_iblock)
#define Delay_destruct_fields  FC_MAKE_NAME(Delay_destruct_fields)
#define Delay_step             FC_MAKE_NAME(Delay_step)
#define Delay_preload          FC_MAKE_NAME(Delay_preload)

#define Delay_Test_type        FC_MAKE_NAME(Delay_Test_type)


typedef struct Delay
{
  IBlock block; //!< MUST BE FIRST FIELD IN STRUCT TO ALLOW CASTING FROM PARENT TYPE
  uint16_t saved_sample_length;
  fc_PTYPE* previous_samples; //!< index zero is most recent
} Delay;


void Delay_ctor(Delay* block);
Delay* Delay_new(fc_BuildCtx* bc, uint16_t history_depth);
IBlock* Delay_new_iblock(fc_BuildCtx* bc, uint16_t history_depth);

/**
 * Class method.
 * Use to check if an IBlock is a Delay block.
 */
bool Delay_Test_type(void* some_block);



//#########################################################################################################
// IBlock interface methods
//#########################################################################################################

void Delay_destruct_fields(void* self, fc_IAllocator const * allocator);
void Delay_preload(void* self, fc_PTYPE input);
fc_PTYPE Delay_step(void* self, fc_PTYPE input);



//#########################################################################################################
// Unit testing stuff
//#########################################################################################################

//The following methods are useful for unit testing using generic C++ code.
//THESE functions must be static because they are defined in a header
#if defined(__cplusplus) && defined(fc_UNIT_TESTING)
extern "C++" {

#ifndef _fc_CPP_TEST_DELAY_INCLUDE_GUARD
#define _fc_CPP_TEST_DELAY_INCLUDE_GUARD
  template <typename BlockType>
  static BlockType* CppDelay_new(fc_BuildCtx* bc, uint16_t length);

  template <typename BlockType>
  static BlockType* CppDelay_new_iblock(fc_BuildCtx* bc, uint16_t length);
#endif


  template <>
  static Delay* CppDelay_new<Delay>(fc_BuildCtx* bc, uint16_t length) {
    return Delay_new(bc, length);
  }

  template <>
  static Delay* CppDelay_new_iblock<Delay>(fc_BuildCtx* bc, uint16_t length) {
    return (Delay*)Delay_new_iblock(bc, length);
  }


  //TODO rename CppHelperFilterType to CppHelperBlockType
  #define CppHelperFilterType     Delay
  #include "fc_lib/templates/fc_cpp_helper.ipp"
}

#endif