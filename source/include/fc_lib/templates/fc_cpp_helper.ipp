  #define CppHelperType_ctor          ECAT(CppHelperFilterType, _ctor, , )
  #define CppHelperType_preload       ECAT(CppHelperFilterType, _preload, , )
  #define CppHelperType_step          ECAT(CppHelperFilterType, _step, , )
  #define CppHelperType_Test_type     ECAT(CppHelperFilterType, _Test_type, , )

  //THESE functions must be static because they are defined in a header

  static void CppX_ctor(CppHelperFilterType* block) {
    //TODOLOW: could consider putting another test hook in here to ensure that the tests for each block call this.
    //could even capture block pointer for more indepth testing.
    CppHelperType_ctor(block);
  }

  static void CppX_preload(CppHelperFilterType* block, fc_PTYPE input) {
    CppHelperType_preload(block, input);
  }

  static fc_PTYPE CppX_step(CppHelperFilterType* block, fc_PTYPE input) {
    return CppHelperType_step(block, input);
  }

  template <>
  static bool CppX_Test_type<CppHelperFilterType>(void* some_iblock) {
    return CppHelperType_Test_type(some_iblock);
  }

 

  //see `fc_template_root.h` for details.
  //from https:stackoverflow.com/questions/36526400/is-there-a-way-to-make-a-function-return-a-typename
  template <> struct FilterPrimitiveTypeSelector<CppHelperFilterType> { using type = fc_PTYPE; };

  //below "&" reference syntax needed to allow:
  //    fc32_PassThrough* p1 = fc32_PassThrough_new(bc);
  //    using PrimitiveType = FilterPrimitiveTypeSelector<decltype(*p1)>::type;
  template <> struct FilterPrimitiveTypeSelector<CppHelperFilterType&> { using type = fc_PTYPE; };


  #undef CppHelperFilterType
  #undef CppHelperType_ctor      
  #undef CppHelperType_preload   
  #undef CppHelperType_step      
  #undef CppHelperType_Test_type 
