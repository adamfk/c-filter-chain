#include <stddef.h>
#include <stdio.h>

extern "C" {

  int pow2(int x) {
    return x*x;
  }
  
  char const * get_string(void) {
    return "well hi there!";
  }

  void * get_null(void) {
    return NULL;
  }
  
  void print_something(void) {
    printf("this is something to print\n");
  }
  
  int sizeof_ptr(void){
    return sizeof((int*)NULL);
  }
  
  int count_list(int** list) {
    int i;
    int* element;
    
    printf("list: %i\n", (int)list);
    
    do {
      element = list[i];
      printf("list[%i]: %i\n", i, (int)element);
      i++;
    } while (element != NULL);
    
    return i;
  }
  
}


//http://kapadia.github.io/emscripten/2013/09/13/emscripten-pointers-and-pointers.html