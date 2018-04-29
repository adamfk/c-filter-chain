#pragma once
/*
  The build for emscripten will use standard malloc/free functions
*/
#define fc_MALLOC_FUNC   malloc 
#define fc_FREE_FUNC     free 
