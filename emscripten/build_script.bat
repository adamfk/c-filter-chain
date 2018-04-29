
rem The below bat file is ignored by git and needs to do something like: set emsdk_path=C:\some\path\to\...\emsdk
call user_set_emsdk_path.bat

set fc_lib_inc=..\source\include
set fc_lib_src=..\source\include\fc_lib

:: You may need to do: call %emsdk_path%\emsdk activate latest
:: but don't do that in this script though as it causes system libraries to be rebuilt instead of cached (takes minutes).

call %emsdk_path%\emsdk_env.bat

set optimization=-O0
:: "-O0"
::    No optimizations (default). This is the recommended setting for
::    starting to port a project, as it includes various assertions.


set debug_info=-g4
:: "-g4": Preserve LLVM debug information. This is the highest
::        level of debuggability. If "-g" was used when compiling the
::        C/C++ sources, this shows line number debug comments, and
::        generates source maps.


emcc %optimization%  %debug_info%  -I%fc_lib_inc%  %fc_lib_src%\fc_allocate.c