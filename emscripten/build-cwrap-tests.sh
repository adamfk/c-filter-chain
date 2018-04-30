
# The below sh file is ignored by git and needs to do something like: emsdk_path=C:\some\path\to\...\emsdk
source ./user_set_emsdk_path.sh

# You may need to do: $emsdk_path/emsdk activate latest
# but don't do that in this script though as it causes system libraries to be rebuilt instead of cached (takes minutes).

source $emsdk_path/emsdk_env.sh

optimization=-O0
# "-O0"
#    No optimizations (default). This is the recommended setting for
#    starting to port a project, as it includes various assertions.


debug_info=-g4
# "-g4": Preserve LLVM debug information. This is the highest
#        level of debuggability. If "-g" was used when compiling the
#        C/C++ sources, this shows line number debug comments, and
#        generates source maps.


emcc  $optimization  $debug_info  cwrap-tests.cpp \
  -o cwrap-tests.js \
  -s EXPORTED_FUNCTIONS='[ "_pow2", "_get_string", "_get_null", "_count_list", "_sizeof_ptr", "_print_something" ]' \
  -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]'

