#include "fc_lib/fc32_lib.h"
//#include "fc_lib/fc8_lib.h"
//#include "fc_lib/fcflt_lib.h"

/*

  #include <emscripten/bind.h>
  using namespace emscripten;

  EMSCRIPTEN_BINDINGS(BlockChain) {
    class_<BlockChain>("BlockChain")
      .constructor<>()
      .property("block", &BlockChain::block)
      .property("block_count", &BlockChain::block_count)
      ;
  }

  function("BlockChain_new", BlockChain_new, allow_raw_pointers());

  
  */
  
#include <vector>
  
int count_vector(std::vector<int> list) {
  int i = 0;
  
  for(auto v : list) {
    i++;
  }
  
  return i;
  /*while (list[i] != NULL) {
    i++;
  }
  return i;*/
}
  
  
EMSCRIPTEN_BINDINGS(wrapper) 
{
  function("count_vector", count_vector, allow_raw_pointers());
}

