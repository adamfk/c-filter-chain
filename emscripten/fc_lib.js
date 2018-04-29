// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('Module[\'ENVIRONMENT\'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    Module['printErr']('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
}
else {
  // Unreachable because SHELL is dependent on the others
  throw new Error('unknown runtime environment');
}

// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
Module['print'] = typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null);
Module['printErr'] = typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || Module['print']);

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    Module.printErr(text);
  }
}



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    Module.printErr('Warning: addFunction: Provide a wasm function signature ' +
                    'string as a second argument');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};

// C calling interface.
function ccall (ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === 'string') ret = Pointer_stringify(ret);
  else if (returnType === 'boolean') ret = Boolean(ret);
  if (stack !== 0) {
    stackRestore(stack);
  }
  return ret;
}

function cwrap (ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 4160;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_fc_lib_wrapper_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });


/* memory initializer */ allocate([200,2,0,0,55,3,0,0,0,0,0,0,24,0,0,0,92,2,0,0,74,3,0,0,200,2,0,0,100,3,0,0,1,0,0,0,24,0,0,0,92,2,0,0,149,6,0,0,92,2,0,0,180,6,0,0,92,2,0,0,211,6,0,0,92,2,0,0,242,6,0,0,92,2,0,0,17,7,0,0,92,2,0,0,48,7,0,0,92,2,0,0,79,7,0,0,92,2,0,0,110,7,0,0,92,2,0,0,141,7,0,0,92,2,0,0,172,7,0,0,92,2,0,0,203,7,0,0,92,2,0,0,234,7,0,0,92,2,0,0,9,8,0,0,228,2,0,0,28,8,0,0,0,0,0,0,1,0,0,0,176,0,0,0,0,0,0,0,92,2,0,0,91,8,0,0,228,2,0,0,129,8,0,0,0,0,0,0,1,0,0,0,176,0,0,0,0,0,0,0,228,2,0,0,192,8,0,0,0,0,0,0,1,0,0,0,176,0,0,0,0,0,0,0,132,2,0,0,82,9,0,0,248,0,0,0,0,0,0,0,132,2,0,0,255,8,0,0,8,1,0,0,0,0,0,0,92,2,0,0,32,9,0,0,132,2,0,0,45,9,0,0,232,0,0,0,0,0,0,0,132,2,0,0,152,9,0,0,248,0,0,0,0,0,0,0,132,2,0,0,116,9,0,0,32,1,0,0,0,0,0,0,132,2,0,0,186,9,0,0,248,0,0,0,0,0,0,0,172,2,0,0,226,9,0,0,172,2,0,0,228,9,0,0,172,2,0,0,231,9,0,0,172,2,0,0,233,9,0,0,172,2,0,0,235,9,0,0,172,2,0,0,237,9,0,0,172,2,0,0,239,9,0,0,172,2,0,0,241,9,0,0,172,2,0,0,243,9,0,0,172,2,0,0,245,9,0,0,172,2,0,0,247,9,0,0,172,2,0,0,249,9,0,0,172,2,0,0,251,9,0,0,172,2,0,0,253,9,0,0,132,2,0,0,255,9,0,0,232,0,0,0,0,0,0,0,8,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,54,12,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,212,1,0,0,0,0,0,0,232,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,0,0,0,0,16,1,0,0,4,0,0,0,12,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,0,0,0,0,64,1,0,0,4,0,0,0,16,0,0,0,6,0,0,0,7,0,0,0,17,0,0,0,0,0,0,0,48,1,0,0,4,0,0,0,18,0,0,0,6,0,0,0,7,0,0,0,19,0,0,0,0,0,0,0,192,1,0,0,4,0,0,0,20,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,21,0,0,0,22,0,0,0,23,0,0,0,73,105,114,76,111,119,80,97,115,115,0,110,101,119,95,114,97,116,105,111,0,108,97,115,116,95,111,117,116,112,117,116,0,118,105,105,105,0,105,105,105,0,118,105,105,102,0,102,105,105,0,80,49,53,102,99,51,50,95,73,105,114,76,111,119,80,97,115,115,0,49,53,102,99,51,50,95,73,105,114,76,111,119,80,97,115,115,0,118,105,0,118,0,105,105,0,80,75,49,53,102,99,51,50,95,73,105,114,76,111,119,80,97,115,115,0,118,111,105,100,0,98,111,111,108,0,99,104,97,114,0,115,105,103,110,101,100,32,99,104,97,114,0,117,110,115,105,103,110,101,100,32,99,104,97,114,0,115,104,111,114,116,0,117,110,115,105,103,110,101,100,32,115,104,111,114,116,0,105,110,116,0,117,110,115,105,103,110,101,100,32,105,110,116,0,108,111,110,103,0,117,110,115,105,103,110,101,100,32,108,111,110,103,0,102,108,111,97,116,0,100,111,117,98,108,101,0,115,116,100,58,58,115,116,114,105,110,103,0,115,116,100,58,58,98,97,115,105,99,95,115,116,114,105,110,103,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,115,116,100,58,58,119,115,116,114,105,110,103,0,101,109,115,99,114,105,112,116,101,110,58,58,118,97,108,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,102,108,111,97,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,100,111,117,98,108,101,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,32,100,111,117,98,108,101,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,101,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,100,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,102,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,109,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,108,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,106,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,105,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,116,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,115,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,104,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,97,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,99,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,51,118,97,108,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,119,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,119,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,119,69,69,69,69,0,78,83,116,51,95,95,50,50,49,95,95,98,97,115,105,99,95,115,116,114,105,110,103,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,104,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,104,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,99,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,99,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,99,69,69,69,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,51,95,95,102,117,110,100,97,109,101,110,116,97,108,95,116,121,112,101,95,105,110,102,111,69,0,118,0,68,110,0,98,0,99,0,104,0,97,0,115,0,116,0,105,0,106,0,108,0,109,0,102,0,100,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,49,95,95,118,109,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___lock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }
  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }
  
  
  
  var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module["asm"]['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module["asm"]['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = embind__requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = embind__requireFunction(downcastSignature, downcast);
      }
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  function validateThis(this_, classType, humanName) {
      if (!(this_ instanceof Object)) {
          throwBindingError(humanName + ' with invalid "this": ' + this_);
      }
      if (!(this_ instanceof classType.registeredClass.constructor)) {
          throwBindingError(humanName + ' incompatible with "this" of type ' + this_.constructor.name);
      }
      if (!this_.$$.ptr) {
          throwBindingError('cannot call emscripten binding method ' + humanName + ' on deleted object');
      }
  
      // todo: kill this
      return upcastPointer(
          this_.$$.ptr,
          this_.$$.ptrType.registeredClass,
          classType.registeredClass);
    }function __embind_register_class_property(
      classType,
      fieldName,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      fieldName = readLatin1String(fieldName);
      getter = embind__requireFunction(getterSignature, getter);
  
      whenDependentTypesAreResolved([], [classType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + fieldName;
          var desc = {
              get: function() {
                  throwUnboundTypeError('Cannot access ' + humanName + ' due to unbound types', [getterReturnType, setterArgumentType]);
              },
              enumerable: true,
              configurable: true
          };
          if (setter) {
              desc.set = function() {
                  throwUnboundTypeError('Cannot access ' + humanName + ' due to unbound types', [getterReturnType, setterArgumentType]);
              };
          } else {
              desc.set = function(v) {
                  throwBindingError(humanName + ' is a read-only property');
              };
          }
  
          Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
  
          whenDependentTypesAreResolved(
              [],
              (setter ? [getterReturnType, setterArgumentType] : [getterReturnType]),
          function(types) {
              var getterReturnType = types[0];
              var desc = {
                  get: function() {
                      var ptr = validateThis(this, classType, humanName + ' getter');
                      return getterReturnType['fromWireType'](getter(getterContext, ptr));
                  },
                  enumerable: true
              };
  
              if (setter) {
                  setter = embind__requireFunction(setterSignature, setter);
                  var setterArgumentType = types[1];
                  desc.set = function(v) {
                      var ptr = validateThis(this, classType, humanName + ' setter');
                      var destructors = [];
                      setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, v));
                      runDestructors(destructors);
                  };
              }
  
              Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
              return [];
          });
  
          return [];
      });
    }

  
  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }
  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
  
      var fromWireType = function(value) {
          return value;
      };
  
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      var isUnsignedType = (name.indexOf('unsigned') != -1);
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return isUnsignedType ? (value >>> 0) : (value | 0);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              function getTAElement(ta, index) {
                  return ta[index];
              }
              function getStringElement(string, index) {
                  return string.charCodeAt(index);
              }
              var getElement;
              if (value instanceof Uint8Array) {
                  getElement = getTAElement;
              } else if (value instanceof Uint8ClampedArray) {
                  getElement = getTAElement;
              } else if (value instanceof Int8Array) {
                  getElement = getTAElement;
              } else if (typeof value === 'string') {
                  getElement = getStringElement;
              } else {
                  throwBindingError('Cannot pass non-string to std::string');
              }
  
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length);
              HEAPU32[ptr >> 2] = length;
              for (var i = 0; i < length; ++i) {
                  var charCode = getElement(value, i);
                  if (charCode > 255) {
                      _free(ptr);
                      throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                  }
                  HEAPU8[ptr + 4 + i] = charCode;
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  function _abort() {
      Module['abort']();
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    } 
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}



function nullFunc_dii(x) { Module["printErr"]("Invalid function pointer called with signature 'dii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_i(x) { Module["printErr"]("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { Module["printErr"]("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viid(x) { Module["printErr"]("Invalid function pointer called with signature 'viid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viii(x) { Module["printErr"]("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_dii(index,a1,a2) {
  try {
    return Module["dynCall_dii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viid(index,a1,a2,a3) {
  try {
    Module["dynCall_viid"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_dii": nullFunc_dii, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iii": nullFunc_iii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_viid": nullFunc_viid, "nullFunc_viii": nullFunc_viii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "invoke_dii": invoke_dii, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iii": invoke_iii, "invoke_iiii": invoke_iiii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_viid": invoke_viid, "invoke_viii": invoke_viii, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_class_property": __embind_register_class_property, "__embind_register_emval": __embind_register_emval, "__embind_register_float": __embind_register_float, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_void": __embind_register_void, "__emval_decref": __emval_decref, "__emval_register": __emval_register, "_abort": _abort, "_embind_repr": _embind_repr, "_emscripten_memcpy_big": _emscripten_memcpy_big, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "ensureOverloadTable": ensureOverloadTable, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "validateThis": validateThis, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_dii=env.nullFunc_dii;
  var nullFunc_i=env.nullFunc_i;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iii=env.nullFunc_iii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_vi=env.nullFunc_vi;
  var nullFunc_viid=env.nullFunc_viid;
  var nullFunc_viii=env.nullFunc_viii;
  var nullFunc_viiii=env.nullFunc_viiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_viiiiii=env.nullFunc_viiiiii;
  var invoke_dii=env.invoke_dii;
  var invoke_i=env.invoke_i;
  var invoke_ii=env.invoke_ii;
  var invoke_iii=env.invoke_iii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_v=env.invoke_v;
  var invoke_vi=env.invoke_vi;
  var invoke_viid=env.invoke_viid;
  var invoke_viii=env.invoke_viii;
  var invoke_viiii=env.invoke_viiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var ClassHandle=env.ClassHandle;
  var ClassHandle_clone=env.ClassHandle_clone;
  var ClassHandle_delete=env.ClassHandle_delete;
  var ClassHandle_deleteLater=env.ClassHandle_deleteLater;
  var ClassHandle_isAliasOf=env.ClassHandle_isAliasOf;
  var ClassHandle_isDeleted=env.ClassHandle_isDeleted;
  var RegisteredClass=env.RegisteredClass;
  var RegisteredPointer=env.RegisteredPointer;
  var RegisteredPointer_deleteObject=env.RegisteredPointer_deleteObject;
  var RegisteredPointer_destructor=env.RegisteredPointer_destructor;
  var RegisteredPointer_fromWireType=env.RegisteredPointer_fromWireType;
  var RegisteredPointer_getPointee=env.RegisteredPointer_getPointee;
  var ___lock=env.___lock;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var __embind_register_bool=env.__embind_register_bool;
  var __embind_register_class=env.__embind_register_class;
  var __embind_register_class_constructor=env.__embind_register_class_constructor;
  var __embind_register_class_property=env.__embind_register_class_property;
  var __embind_register_emval=env.__embind_register_emval;
  var __embind_register_float=env.__embind_register_float;
  var __embind_register_integer=env.__embind_register_integer;
  var __embind_register_memory_view=env.__embind_register_memory_view;
  var __embind_register_std_string=env.__embind_register_std_string;
  var __embind_register_std_wstring=env.__embind_register_std_wstring;
  var __embind_register_void=env.__embind_register_void;
  var __emval_decref=env.__emval_decref;
  var __emval_register=env.__emval_register;
  var _abort=env._abort;
  var _embind_repr=env._embind_repr;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var constNoSmartPtrRawPointerToWireType=env.constNoSmartPtrRawPointerToWireType;
  var count_emval_handles=env.count_emval_handles;
  var createNamedFunction=env.createNamedFunction;
  var downcastPointer=env.downcastPointer;
  var embind__requireFunction=env.embind__requireFunction;
  var embind_init_charCodes=env.embind_init_charCodes;
  var ensureOverloadTable=env.ensureOverloadTable;
  var exposePublicSymbol=env.exposePublicSymbol;
  var extendError=env.extendError;
  var floatReadValueFromPointer=env.floatReadValueFromPointer;
  var flushPendingDeletes=env.flushPendingDeletes;
  var flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM;
  var genericPointerToWireType=env.genericPointerToWireType;
  var getBasestPointer=env.getBasestPointer;
  var getInheritedInstance=env.getInheritedInstance;
  var getInheritedInstanceCount=env.getInheritedInstanceCount;
  var getLiveInheritedInstances=env.getLiveInheritedInstances;
  var getShiftFromSize=env.getShiftFromSize;
  var getTypeName=env.getTypeName;
  var get_first_emval=env.get_first_emval;
  var heap32VectorToArray=env.heap32VectorToArray;
  var init_ClassHandle=env.init_ClassHandle;
  var init_RegisteredPointer=env.init_RegisteredPointer;
  var init_embind=env.init_embind;
  var init_emval=env.init_emval;
  var integerReadValueFromPointer=env.integerReadValueFromPointer;
  var makeClassHandle=env.makeClassHandle;
  var makeLegalFunctionName=env.makeLegalFunctionName;
  var nonConstNoSmartPtrRawPointerToWireType=env.nonConstNoSmartPtrRawPointerToWireType;
  var readLatin1String=env.readLatin1String;
  var registerType=env.registerType;
  var replacePublicSymbol=env.replacePublicSymbol;
  var runDestructor=env.runDestructor;
  var runDestructors=env.runDestructors;
  var setDelayFunction=env.setDelayFunction;
  var shallowCopyInternalPointer=env.shallowCopyInternalPointer;
  var simpleReadValueFromPointer=env.simpleReadValueFromPointer;
  var throwBindingError=env.throwBindingError;
  var throwInstanceAlreadyDeleted=env.throwInstanceAlreadyDeleted;
  var throwInternalError=env.throwInternalError;
  var throwUnboundTypeError=env.throwUnboundTypeError;
  var upcastPointer=env.upcastPointer;
  var validateThis=env.validateThis;
  var whenDependentTypesAreResolved=env.whenDependentTypesAreResolved;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function __GLOBAL__sub_I_fc_lib_wrapper_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init();
 return;
}
function ___cxx_global_var_init() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN39EmscriptenBindingInitializer_IirLowPassC2Ev(3116); //@line 56 "../source/include/fc_lib/templates/fc_IirLowPass.h"
 return; //@line 56 "../source/include/fc_lib/templates/fc_IirLowPass.h"
}
function __ZN39EmscriptenBindingInitializer_IirLowPassC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $5 = sp + 100|0;
 $12 = sp + 72|0;
 $18 = sp + 121|0;
 $32 = sp + 120|0;
 $31 = $0;
 $25 = $32;
 $26 = 772;
 __ZN10emscripten8internal11NoBaseClass6verifyI15fc32_IirLowPassEEvv(); //@line 1121 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $27 = 24; //@line 1123 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $33 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI15fc32_IirLowPassEEPFvvEv()|0); //@line 1124 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $28 = $33; //@line 1124 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $34 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI15fc32_IirLowPassEEPFvvEv()|0); //@line 1125 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $29 = $34; //@line 1125 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $30 = 25; //@line 1126 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $35 = (__ZN10emscripten8internal6TypeIDI15fc32_IirLowPassE3getEv()|0); //@line 1129 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $36 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI15fc32_IirLowPassEEE3getEv()|0); //@line 1130 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $37 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK15fc32_IirLowPassEEE3getEv()|0); //@line 1131 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $38 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0); //@line 1132 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $39 = $27; //@line 1133 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $24 = $39;
 $40 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $41 = $27; //@line 1134 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $42 = $28; //@line 1135 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $23 = $42;
 $43 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $44 = $28; //@line 1136 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $45 = $29; //@line 1137 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $22 = $45;
 $46 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $47 = $29; //@line 1138 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $48 = $26; //@line 1139 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $49 = $30; //@line 1140 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $21 = $49;
 $50 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $51 = $30; //@line 1141 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 __embind_register_class(($35|0),($36|0),($37|0),($38|0),($40|0),($41|0),($43|0),($44|0),($46|0),($47|0),($48|0),($50|0),($51|0)); //@line 1128 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $20 = $32;
 $52 = $20;
 $16 = $52;
 $17 = 26;
 $53 = $16;
 $19 = 27; //@line 1187 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $54 = (__ZN10emscripten8internal6TypeIDI15fc32_IirLowPassE3getEv()|0); //@line 1189 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $55 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15fc32_IirLowPassEE8getCountEv($18)|0); //@line 1190 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $56 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15fc32_IirLowPassEE8getTypesEv($18)|0); //@line 1191 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $57 = $19; //@line 1192 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $15 = $57;
 $58 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $59 = $19; //@line 1193 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $60 = $17; //@line 1194 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 __embind_register_class_constructor(($54|0),($55|0),($56|0),($58|0),($59|0),($60|0)); //@line 1188 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $10 = $53;
 $11 = 783;
 HEAP32[$12>>2] = 4;
 $61 = $10;
 $13 = 28; //@line 1345 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $14 = 29; //@line 1346 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $62 = (__ZN10emscripten8internal6TypeIDI15fc32_IirLowPassE3getEv()|0); //@line 1348 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $63 = $11; //@line 1349 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $64 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0); //@line 1350 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $65 = $13; //@line 1351 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $9 = $65;
 $66 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $67 = $13; //@line 1352 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $68 = (__ZN10emscripten8internal10getContextIM15fc32_IirLowPassfEEPT_RKS4_($12)|0); //@line 1353 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $69 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0); //@line 1354 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $70 = $14; //@line 1355 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $8 = $70;
 $71 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $72 = $14; //@line 1356 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $73 = (__ZN10emscripten8internal10getContextIM15fc32_IirLowPassfEEPT_RKS4_($12)|0); //@line 1357 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 __embind_register_class_property(($62|0),($63|0),($64|0),($66|0),($67|0),($68|0),($69|0),($71|0),($72|0),($73|0)); //@line 1347 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $3 = $61;
 $4 = 793;
 HEAP32[$5>>2] = 8;
 $6 = 30; //@line 1345 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $7 = 31; //@line 1346 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $74 = (__ZN10emscripten8internal6TypeIDI15fc32_IirLowPassE3getEv()|0); //@line 1348 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $75 = $4; //@line 1349 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $76 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0); //@line 1350 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $77 = $6; //@line 1351 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $2 = $77;
 $78 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $79 = $6; //@line 1352 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $80 = (__ZN10emscripten8internal10getContextIM15fc32_IirLowPassiEEPT_RKS4_($5)|0); //@line 1353 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $81 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0); //@line 1354 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $82 = $7; //@line 1355 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $1 = $82;
 $83 = (__ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv()|0); //@line 399 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $84 = $7; //@line 1356 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $85 = (__ZN10emscripten8internal10getContextIM15fc32_IirLowPassiEEPT_RKS4_($5)|0); //@line 1357 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 __embind_register_class_property(($74|0),($75|0),($76|0),($78|0),($79|0),($80|0),($81|0),($83|0),($84|0),($85|0)); //@line 1347 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return; //@line 64 "../source/include/fc_lib/templates/fc_IirLowPass.h"
}
function __ZN10emscripten8internal11NoBaseClass6verifyI15fc32_IirLowPassEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return; //@line 1009 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal13getActualTypeI15fc32_IirLowPassEEPKvPT_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 1029 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $3 = (__ZN10emscripten8internal14getLightTypeIDI15fc32_IirLowPassEEPKvRKT_($2)|0); //@line 1029 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($3|0); //@line 1029 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterI15fc32_IirLowPassEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0); //@line 1017 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterI15fc32_IirLowPassEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0); //@line 1022 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal14raw_destructorI15fc32_IirLowPassEEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 452 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $3 = ($2|0)==(0|0); //@line 452 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 if (!($3)) {
  __ZdlPv($2); //@line 452 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 }
 STACKTOP = sp;return; //@line 453 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal6TypeIDI15fc32_IirLowPassE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI15fc32_IirLowPassE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI15fc32_IirLowPassEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP15fc32_IirLowPassE3getEv()|0); //@line 121 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 121 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK15fc32_IirLowPassEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK15fc32_IirLowPassE3getEv()|0); //@line 121 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 121 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11NoBaseClass3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0); //@line 1012 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (865|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (863|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (860|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal12operator_newI15fc32_IirLowPassJEEEPT_DpOT0_() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__Znwj(12)|0); //@line 433 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 ;HEAP32[$0>>2]=0|0;HEAP32[$0+4>>2]=0|0;HEAP32[$0+8>>2]=0|0; //@line 433 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 return ($0|0); //@line 433 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal7InvokerIP15fc32_IirLowPassJEE6invokeEPFS3_vE($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 330 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $3 = (FUNCTION_TABLE_i[$2 & 31]()|0); //@line 330 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $4 = (__ZN10emscripten8internal11BindingTypeIP15fc32_IirLowPassE10toWireTypeES3_($3)|0); //@line 329 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($4|0); //@line 329 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15fc32_IirLowPassEE8getCountEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return 1; //@line 224 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15fc32_IirLowPassEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI15fc32_IirLowPassEEEEEE3getEv()|0); //@line 228 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 228 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassfE7getWireIS2_EEfRKMS2_fRKT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $3; //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $5 = $2; //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $6 = HEAP32[$5>>2]|0; //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $7 = (($4) + ($6)|0); //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $8 = (+__ZN10emscripten8internal11BindingTypeIfE10toWireTypeERKf($7)); //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return (+$8); //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassfE7setWireIS2_EEvRKMS2_fRT_f($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $5; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $7 = (+__ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($6)); //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $8 = $4; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $9 = $3; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $10 = HEAP32[$9>>2]|0; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $11 = (($8) + ($10)|0); //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 HEAPF32[$11>>2] = $7; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return; //@line 537 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal6TypeIDIfE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIfE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (819|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal10getContextIM15fc32_IirLowPassfEEPT_RKS4_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__Znwj(4)|0); //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $3 = $1; //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $4 = HEAP32[$3>>2]|0; //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 HEAP32[$2>>2] = $4; //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($2|0); //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (814|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassiE7getWireIS2_EEiRKMS2_iRKT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $3; //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $5 = $2; //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $6 = HEAP32[$5>>2]|0; //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $7 = (($4) + ($6)|0); //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $8 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($7)|0); //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($8|0); //@line 527 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassiE7setWireIS2_EEvRKMS2_iRT_i($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $5; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $7 = (__ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($6)|0); //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $8 = $4; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $9 = $3; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $10 = HEAP32[$9>>2]|0; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $11 = (($8) + ($10)|0); //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 HEAP32[$11>>2] = $7; //@line 536 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return; //@line 537 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal6TypeIDIiE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIiE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (810|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal10getContextIM15fc32_IirLowPassiEEPT_RKS4_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__Znwj(4)|0); //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $3 = $1; //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 $4 = HEAP32[$3>>2]|0; //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 HEAP32[$2>>2] = $4; //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($2|0); //@line 558 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (805|0); //@line 389 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11LightTypeIDIiE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (400|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 257 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 257 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 257 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 $3 = HEAP32[$2>>2]|0; //@line 257 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($3|0); //@line 257 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIfE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (432|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 261 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 STACKTOP = sp;return (+$2); //@line 261 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIfE10toWireTypeERKf($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 261 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 $3 = +HEAPF32[$2>>2]; //@line 261 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 STACKTOP = sp;return (+$3); //@line 261 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI15fc32_IirLowPassEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (464|0); //@line 208 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIP15fc32_IirLowPassE10toWireTypeES3_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 341 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 341 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIPK15fc32_IirLowPassE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (32|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIP15fc32_IirLowPassE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (8|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDI15fc32_IirLowPassE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (24|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal14getLightTypeIDI15fc32_IirLowPassEEPKvRKT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return (24|0); //@line 82 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __GLOBAL__sub_I_bind_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init_2();
 return;
}
function ___cxx_global_var_init_2() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev(3117); //@line 95 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 return; //@line 95 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIvE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_void(($2|0),(888|0)); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN10emscripten8internal6TypeIDIbE3getEv()|0); //@line 100 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_bool(($3|0),(893|0),1,1,0); //@line 100 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc(898); //@line 102 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc(903); //@line 103 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc(915); //@line 104 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc(929); //@line 105 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerItEEvPKc(935); //@line 106 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc(950); //@line 107 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc(954); //@line 108 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc(967); //@line 109 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L16register_integerImEEvPKc(972); //@line 110 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc(986); //@line 112 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc(992); //@line 113 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0); //@line 115 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_std_string(($4|0),(999|0)); //@line 115 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $5 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0); //@line 116 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_std_string(($5|0),(1011|0)); //@line 116 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $6 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0); //@line 117 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_std_wstring(($6|0),4,(1044|0)); //@line 117 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $7 = (__ZN10emscripten8internal6TypeIDINS_3valEE3getEv()|0); //@line 118 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_emval(($7|0),(1057|0)); //@line 118 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc(1073); //@line 126 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(1103); //@line 127 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(1140); //@line 128 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(1179); //@line 130 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(1210); //@line 131 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(1250); //@line 132 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(1279); //@line 133 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc(1317); //@line 134 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc(1347); //@line 135 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(1386); //@line 137 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(1418); //@line 138 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(1451); //@line 139 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(1484); //@line 140 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(1518); //@line 141 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(1551); //@line 142 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc(1585); //@line 144 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc(1616); //@line 145 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc(1648); //@line 147 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 149 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal6TypeIDIvE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIvE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIbE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIbE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIcE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = -128 << 24 >> 24; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $5 = 127 << 24 >> 24; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),1,($4|0),($5|0)); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIaE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = -128 << 24 >> 24; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $5 = 127 << 24 >> 24; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),1,($4|0),($5|0)); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIhE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = 0; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $5 = 255; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),1,($4|0),($5|0)); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIsE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = -32768 << 16 >> 16; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $5 = 32767 << 16 >> 16; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),2,($4|0),($5|0)); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerItEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDItE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = 0; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $5 = 65535; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),2,($4|0),($5|0)); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,-2147483648,2147483647); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,0,-1); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIlE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,-2147483648,2147483647); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L16register_integerImEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDImE3getEv()|0); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,0,-1); //@line 51 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0); //@line 57 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 57 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_float(($2|0),($3|0),4); //@line 57 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 58 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIdE3getEv()|0); //@line 57 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = $1; //@line 57 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_float(($2|0),($3|0),8); //@line 57 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 58 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_3valEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv()|0); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 7; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (48|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 7; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (56|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 6; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (64|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (72|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (80|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (88|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (96|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (104|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (112|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (120|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (128|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0; //@line 77 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (136|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (144|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (152|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (184|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (208|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIdE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIdE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIdE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (440|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDImE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDImE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDImE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (424|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIlE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIlE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIlE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (416|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIjE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIjE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIjE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (408|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDItE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDItE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDItE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (392|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIsE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIsE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIsE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (384|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIhE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIhE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIhE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (368|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIaE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIaE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (376|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIcE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIcE3getEv()|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIcE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (360|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIbE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (352|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIvE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (336|0); //@line 62 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/emscripten/wire.h"
}
function ___getTypeName($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $2; //@line 37 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 $1 = $3;
 $4 = $1;
 $5 = ((($4)) + 4|0); //@line 152 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/libcxx/typeinfo"
 $6 = HEAP32[$5>>2]|0; //@line 152 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/include/libcxx/typeinfo"
 $7 = (___strdup($6)|0); //@line 37 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
 STACKTOP = sp;return ($7|0); //@line 37 "/mnt/c/Users/akruck/Documents/code/linuxtools/emsdk/emscripten/1.37.38/system/lib/embind/bind.cpp"
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0192$i = 0, $$$0193$i = 0, $$$4236$i = 0, $$$4351$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i17$i = 0, $$0189$i = 0, $$0192$lcssa$i = 0, $$01926$i = 0, $$0193$lcssa$i = 0, $$01935$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0;
 var $$024367$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0289$i$i = 0, $$0295$i$i = 0, $$0296$i$i = 0, $$0342$i = 0, $$0344$i = 0, $$0345$i = 0, $$0347$i = 0, $$0353$i = 0, $$0358$i = 0, $$0359$$i = 0, $$0359$i = 0, $$0361$i = 0, $$0362$i = 0, $$0368$i = 0, $$1196$i = 0, $$1198$i = 0, $$124466$i = 0;
 var $$1291$i$i = 0, $$1293$i$i = 0, $$1343$i = 0, $$1348$i = 0, $$1363$i = 0, $$1370$i = 0, $$1374$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2355$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i203 = 0, $$3350$i = 0, $$3372$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$414$i = 0, $$4236$i = 0;
 var $$4351$lcssa$i = 0, $$435113$i = 0, $$4357$$4$i = 0, $$4357$ph$i = 0, $$435712$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i18$i = 0, $$pre$i210 = 0, $$pre$i212 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i19$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi11$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre10$i$i = 0;
 var $$sink1$i = 0, $$sink1$i$i = 0, $$sink14$i = 0, $$sink2$i = 0, $$sink2$i205 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0;
 var $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0;
 var $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0;
 var $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $107 = 0, $108 = 0;
 var $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0;
 var $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0;
 var $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0;
 var $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0;
 var $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0;
 var $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0;
 var $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0;
 var $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0;
 var $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0;
 var $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0;
 var $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0;
 var $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0;
 var $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0;
 var $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0;
 var $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0;
 var $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0;
 var $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0;
 var $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0;
 var $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0;
 var $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0;
 var $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0;
 var $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0;
 var $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0;
 var $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0;
 var $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0;
 var $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0;
 var $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0;
 var $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0;
 var $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0;
 var $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0;
 var $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0;
 var $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0;
 var $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0;
 var $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0;
 var $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0;
 var $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0;
 var $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0;
 var $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0;
 var $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0;
 var $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0;
 var $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0;
 var $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0;
 var $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0;
 var $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0;
 var $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0;
 var $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0;
 var $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0;
 var $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0;
 var $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0;
 var $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i209 = 0, $not$$i = 0, $not$7$i = 0, $or$cond$i = 0, $or$cond$i214 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0;
 var $or$cond2$i = 0, $or$cond2$i215 = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[650]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (2640 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($16|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[650] = $24;
     } else {
      $25 = HEAP32[(2616)>>2]|0;
      $26 = ($25>>>0)>($20>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(2608)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (2640 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($73|0)==($69|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[650] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(2616)>>2]|0;
       $79 = ($78>>>0)>($73>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($71) + ($83)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(2620)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (2640 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[650] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(2616)>>2]|0;
       $104 = ($103>>>0)>($102>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(2608)>>2] = $84;
     HEAP32[(2620)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(2604)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (2904 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $139 = ((($134)) + 16|0);
     $140 = HEAP32[$139>>2]|0;
     $141 = ($140|0)==(0|0);
     $$sink14$i = $141&1;
     $142 = (((($134)) + 16|0) + ($$sink14$i<<2)|0);
     $143 = HEAP32[$142>>2]|0;
     $144 = ($143|0)==(0|0);
     if ($144) {
      $$0192$lcssa$i = $134;$$0193$lcssa$i = $138;
     } else {
      $$01926$i = $134;$$01935$i = $138;$146 = $143;
      while(1) {
       $145 = ((($146)) + 4|0);
       $147 = HEAP32[$145>>2]|0;
       $148 = $147 & -8;
       $149 = (($148) - ($6))|0;
       $150 = ($149>>>0)<($$01935$i>>>0);
       $$$0193$i = $150 ? $149 : $$01935$i;
       $$$0192$i = $150 ? $146 : $$01926$i;
       $151 = ((($146)) + 16|0);
       $152 = HEAP32[$151>>2]|0;
       $153 = ($152|0)==(0|0);
       $$sink1$i = $153&1;
       $154 = (((($146)) + 16|0) + ($$sink1$i<<2)|0);
       $155 = HEAP32[$154>>2]|0;
       $156 = ($155|0)==(0|0);
       if ($156) {
        $$0192$lcssa$i = $$$0192$i;$$0193$lcssa$i = $$$0193$i;
        break;
       } else {
        $$01926$i = $$$0192$i;$$01935$i = $$$0193$i;$146 = $155;
       }
      }
     }
     $157 = HEAP32[(2616)>>2]|0;
     $158 = ($157>>>0)>($$0192$lcssa$i>>>0);
     if ($158) {
      _abort();
      // unreachable;
     }
     $159 = (($$0192$lcssa$i) + ($6)|0);
     $160 = ($159>>>0)>($$0192$lcssa$i>>>0);
     if (!($160)) {
      _abort();
      // unreachable;
     }
     $161 = ((($$0192$lcssa$i)) + 24|0);
     $162 = HEAP32[$161>>2]|0;
     $163 = ((($$0192$lcssa$i)) + 12|0);
     $164 = HEAP32[$163>>2]|0;
     $165 = ($164|0)==($$0192$lcssa$i|0);
     do {
      if ($165) {
       $175 = ((($$0192$lcssa$i)) + 20|0);
       $176 = HEAP32[$175>>2]|0;
       $177 = ($176|0)==(0|0);
       if ($177) {
        $178 = ((($$0192$lcssa$i)) + 16|0);
        $179 = HEAP32[$178>>2]|0;
        $180 = ($179|0)==(0|0);
        if ($180) {
         $$3$i = 0;
         break;
        } else {
         $$1196$i = $179;$$1198$i = $178;
        }
       } else {
        $$1196$i = $176;$$1198$i = $175;
       }
       while(1) {
        $181 = ((($$1196$i)) + 20|0);
        $182 = HEAP32[$181>>2]|0;
        $183 = ($182|0)==(0|0);
        if (!($183)) {
         $$1196$i = $182;$$1198$i = $181;
         continue;
        }
        $184 = ((($$1196$i)) + 16|0);
        $185 = HEAP32[$184>>2]|0;
        $186 = ($185|0)==(0|0);
        if ($186) {
         break;
        } else {
         $$1196$i = $185;$$1198$i = $184;
        }
       }
       $187 = ($157>>>0)>($$1198$i>>>0);
       if ($187) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1198$i>>2] = 0;
        $$3$i = $$1196$i;
        break;
       }
      } else {
       $166 = ((($$0192$lcssa$i)) + 8|0);
       $167 = HEAP32[$166>>2]|0;
       $168 = ($157>>>0)>($167>>>0);
       if ($168) {
        _abort();
        // unreachable;
       }
       $169 = ((($167)) + 12|0);
       $170 = HEAP32[$169>>2]|0;
       $171 = ($170|0)==($$0192$lcssa$i|0);
       if (!($171)) {
        _abort();
        // unreachable;
       }
       $172 = ((($164)) + 8|0);
       $173 = HEAP32[$172>>2]|0;
       $174 = ($173|0)==($$0192$lcssa$i|0);
       if ($174) {
        HEAP32[$169>>2] = $164;
        HEAP32[$172>>2] = $167;
        $$3$i = $164;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $188 = ($162|0)==(0|0);
     L73: do {
      if (!($188)) {
       $189 = ((($$0192$lcssa$i)) + 28|0);
       $190 = HEAP32[$189>>2]|0;
       $191 = (2904 + ($190<<2)|0);
       $192 = HEAP32[$191>>2]|0;
       $193 = ($$0192$lcssa$i|0)==($192|0);
       do {
        if ($193) {
         HEAP32[$191>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $194 = 1 << $190;
          $195 = $194 ^ -1;
          $196 = $108 & $195;
          HEAP32[(2604)>>2] = $196;
          break L73;
         }
        } else {
         $197 = HEAP32[(2616)>>2]|0;
         $198 = ($197>>>0)>($162>>>0);
         if ($198) {
          _abort();
          // unreachable;
         } else {
          $199 = ((($162)) + 16|0);
          $200 = HEAP32[$199>>2]|0;
          $201 = ($200|0)!=($$0192$lcssa$i|0);
          $$sink2$i = $201&1;
          $202 = (((($162)) + 16|0) + ($$sink2$i<<2)|0);
          HEAP32[$202>>2] = $$3$i;
          $203 = ($$3$i|0)==(0|0);
          if ($203) {
           break L73;
          } else {
           break;
          }
         }
        }
       } while(0);
       $204 = HEAP32[(2616)>>2]|0;
       $205 = ($204>>>0)>($$3$i>>>0);
       if ($205) {
        _abort();
        // unreachable;
       }
       $206 = ((($$3$i)) + 24|0);
       HEAP32[$206>>2] = $162;
       $207 = ((($$0192$lcssa$i)) + 16|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       do {
        if (!($209)) {
         $210 = ($204>>>0)>($208>>>0);
         if ($210) {
          _abort();
          // unreachable;
         } else {
          $211 = ((($$3$i)) + 16|0);
          HEAP32[$211>>2] = $208;
          $212 = ((($208)) + 24|0);
          HEAP32[$212>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $213 = ((($$0192$lcssa$i)) + 20|0);
       $214 = HEAP32[$213>>2]|0;
       $215 = ($214|0)==(0|0);
       if (!($215)) {
        $216 = HEAP32[(2616)>>2]|0;
        $217 = ($216>>>0)>($214>>>0);
        if ($217) {
         _abort();
         // unreachable;
        } else {
         $218 = ((($$3$i)) + 20|0);
         HEAP32[$218>>2] = $214;
         $219 = ((($214)) + 24|0);
         HEAP32[$219>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $220 = ($$0193$lcssa$i>>>0)<(16);
     if ($220) {
      $221 = (($$0193$lcssa$i) + ($6))|0;
      $222 = $221 | 3;
      $223 = ((($$0192$lcssa$i)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = (($$0192$lcssa$i) + ($221)|0);
      $225 = ((($224)) + 4|0);
      $226 = HEAP32[$225>>2]|0;
      $227 = $226 | 1;
      HEAP32[$225>>2] = $227;
     } else {
      $228 = $6 | 3;
      $229 = ((($$0192$lcssa$i)) + 4|0);
      HEAP32[$229>>2] = $228;
      $230 = $$0193$lcssa$i | 1;
      $231 = ((($159)) + 4|0);
      HEAP32[$231>>2] = $230;
      $232 = (($159) + ($$0193$lcssa$i)|0);
      HEAP32[$232>>2] = $$0193$lcssa$i;
      $233 = ($37|0)==(0);
      if (!($233)) {
       $234 = HEAP32[(2620)>>2]|0;
       $235 = $37 >>> 3;
       $236 = $235 << 1;
       $237 = (2640 + ($236<<2)|0);
       $238 = 1 << $235;
       $239 = $8 & $238;
       $240 = ($239|0)==(0);
       if ($240) {
        $241 = $8 | $238;
        HEAP32[650] = $241;
        $$pre$i = ((($237)) + 8|0);
        $$0189$i = $237;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $242 = ((($237)) + 8|0);
        $243 = HEAP32[$242>>2]|0;
        $244 = HEAP32[(2616)>>2]|0;
        $245 = ($244>>>0)>($243>>>0);
        if ($245) {
         _abort();
         // unreachable;
        } else {
         $$0189$i = $243;$$pre$phi$iZ2D = $242;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $234;
       $246 = ((($$0189$i)) + 12|0);
       HEAP32[$246>>2] = $234;
       $247 = ((($234)) + 8|0);
       HEAP32[$247>>2] = $$0189$i;
       $248 = ((($234)) + 12|0);
       HEAP32[$248>>2] = $237;
      }
      HEAP32[(2608)>>2] = $$0193$lcssa$i;
      HEAP32[(2620)>>2] = $159;
     }
     $249 = ((($$0192$lcssa$i)) + 8|0);
     $$0 = $249;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $250 = ($0>>>0)>(4294967231);
   if ($250) {
    $$0197 = -1;
   } else {
    $251 = (($0) + 11)|0;
    $252 = $251 & -8;
    $253 = HEAP32[(2604)>>2]|0;
    $254 = ($253|0)==(0);
    if ($254) {
     $$0197 = $252;
    } else {
     $255 = (0 - ($252))|0;
     $256 = $251 >>> 8;
     $257 = ($256|0)==(0);
     if ($257) {
      $$0358$i = 0;
     } else {
      $258 = ($252>>>0)>(16777215);
      if ($258) {
       $$0358$i = 31;
      } else {
       $259 = (($256) + 1048320)|0;
       $260 = $259 >>> 16;
       $261 = $260 & 8;
       $262 = $256 << $261;
       $263 = (($262) + 520192)|0;
       $264 = $263 >>> 16;
       $265 = $264 & 4;
       $266 = $265 | $261;
       $267 = $262 << $265;
       $268 = (($267) + 245760)|0;
       $269 = $268 >>> 16;
       $270 = $269 & 2;
       $271 = $266 | $270;
       $272 = (14 - ($271))|0;
       $273 = $267 << $270;
       $274 = $273 >>> 15;
       $275 = (($272) + ($274))|0;
       $276 = $275 << 1;
       $277 = (($275) + 7)|0;
       $278 = $252 >>> $277;
       $279 = $278 & 1;
       $280 = $279 | $276;
       $$0358$i = $280;
      }
     }
     $281 = (2904 + ($$0358$i<<2)|0);
     $282 = HEAP32[$281>>2]|0;
     $283 = ($282|0)==(0|0);
     L117: do {
      if ($283) {
       $$2355$i = 0;$$3$i203 = 0;$$3350$i = $255;
       label = 81;
      } else {
       $284 = ($$0358$i|0)==(31);
       $285 = $$0358$i >>> 1;
       $286 = (25 - ($285))|0;
       $287 = $284 ? 0 : $286;
       $288 = $252 << $287;
       $$0342$i = 0;$$0347$i = $255;$$0353$i = $282;$$0359$i = $288;$$0362$i = 0;
       while(1) {
        $289 = ((($$0353$i)) + 4|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $290 & -8;
        $292 = (($291) - ($252))|0;
        $293 = ($292>>>0)<($$0347$i>>>0);
        if ($293) {
         $294 = ($292|0)==(0);
         if ($294) {
          $$414$i = $$0353$i;$$435113$i = 0;$$435712$i = $$0353$i;
          label = 85;
          break L117;
         } else {
          $$1343$i = $$0353$i;$$1348$i = $292;
         }
        } else {
         $$1343$i = $$0342$i;$$1348$i = $$0347$i;
        }
        $295 = ((($$0353$i)) + 20|0);
        $296 = HEAP32[$295>>2]|0;
        $297 = $$0359$i >>> 31;
        $298 = (((($$0353$i)) + 16|0) + ($297<<2)|0);
        $299 = HEAP32[$298>>2]|0;
        $300 = ($296|0)==(0|0);
        $301 = ($296|0)==($299|0);
        $or$cond2$i = $300 | $301;
        $$1363$i = $or$cond2$i ? $$0362$i : $296;
        $302 = ($299|0)==(0|0);
        $not$7$i = $302 ^ 1;
        $303 = $not$7$i&1;
        $$0359$$i = $$0359$i << $303;
        if ($302) {
         $$2355$i = $$1363$i;$$3$i203 = $$1343$i;$$3350$i = $$1348$i;
         label = 81;
         break;
        } else {
         $$0342$i = $$1343$i;$$0347$i = $$1348$i;$$0353$i = $299;$$0359$i = $$0359$$i;$$0362$i = $$1363$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 81) {
      $304 = ($$2355$i|0)==(0|0);
      $305 = ($$3$i203|0)==(0|0);
      $or$cond$i = $304 & $305;
      if ($or$cond$i) {
       $306 = 2 << $$0358$i;
       $307 = (0 - ($306))|0;
       $308 = $306 | $307;
       $309 = $253 & $308;
       $310 = ($309|0)==(0);
       if ($310) {
        $$0197 = $252;
        break;
       }
       $311 = (0 - ($309))|0;
       $312 = $309 & $311;
       $313 = (($312) + -1)|0;
       $314 = $313 >>> 12;
       $315 = $314 & 16;
       $316 = $313 >>> $315;
       $317 = $316 >>> 5;
       $318 = $317 & 8;
       $319 = $318 | $315;
       $320 = $316 >>> $318;
       $321 = $320 >>> 2;
       $322 = $321 & 4;
       $323 = $319 | $322;
       $324 = $320 >>> $322;
       $325 = $324 >>> 1;
       $326 = $325 & 2;
       $327 = $323 | $326;
       $328 = $324 >>> $326;
       $329 = $328 >>> 1;
       $330 = $329 & 1;
       $331 = $327 | $330;
       $332 = $328 >>> $330;
       $333 = (($331) + ($332))|0;
       $334 = (2904 + ($333<<2)|0);
       $335 = HEAP32[$334>>2]|0;
       $$4$ph$i = 0;$$4357$ph$i = $335;
      } else {
       $$4$ph$i = $$3$i203;$$4357$ph$i = $$2355$i;
      }
      $336 = ($$4357$ph$i|0)==(0|0);
      if ($336) {
       $$4$lcssa$i = $$4$ph$i;$$4351$lcssa$i = $$3350$i;
      } else {
       $$414$i = $$4$ph$i;$$435113$i = $$3350$i;$$435712$i = $$4357$ph$i;
       label = 85;
      }
     }
     if ((label|0) == 85) {
      while(1) {
       label = 0;
       $337 = ((($$435712$i)) + 4|0);
       $338 = HEAP32[$337>>2]|0;
       $339 = $338 & -8;
       $340 = (($339) - ($252))|0;
       $341 = ($340>>>0)<($$435113$i>>>0);
       $$$4351$i = $341 ? $340 : $$435113$i;
       $$4357$$4$i = $341 ? $$435712$i : $$414$i;
       $342 = ((($$435712$i)) + 16|0);
       $343 = HEAP32[$342>>2]|0;
       $344 = ($343|0)==(0|0);
       $$sink2$i205 = $344&1;
       $345 = (((($$435712$i)) + 16|0) + ($$sink2$i205<<2)|0);
       $346 = HEAP32[$345>>2]|0;
       $347 = ($346|0)==(0|0);
       if ($347) {
        $$4$lcssa$i = $$4357$$4$i;$$4351$lcssa$i = $$$4351$i;
        break;
       } else {
        $$414$i = $$4357$$4$i;$$435113$i = $$$4351$i;$$435712$i = $346;
        label = 85;
       }
      }
     }
     $348 = ($$4$lcssa$i|0)==(0|0);
     if ($348) {
      $$0197 = $252;
     } else {
      $349 = HEAP32[(2608)>>2]|0;
      $350 = (($349) - ($252))|0;
      $351 = ($$4351$lcssa$i>>>0)<($350>>>0);
      if ($351) {
       $352 = HEAP32[(2616)>>2]|0;
       $353 = ($352>>>0)>($$4$lcssa$i>>>0);
       if ($353) {
        _abort();
        // unreachable;
       }
       $354 = (($$4$lcssa$i) + ($252)|0);
       $355 = ($354>>>0)>($$4$lcssa$i>>>0);
       if (!($355)) {
        _abort();
        // unreachable;
       }
       $356 = ((($$4$lcssa$i)) + 24|0);
       $357 = HEAP32[$356>>2]|0;
       $358 = ((($$4$lcssa$i)) + 12|0);
       $359 = HEAP32[$358>>2]|0;
       $360 = ($359|0)==($$4$lcssa$i|0);
       do {
        if ($360) {
         $370 = ((($$4$lcssa$i)) + 20|0);
         $371 = HEAP32[$370>>2]|0;
         $372 = ($371|0)==(0|0);
         if ($372) {
          $373 = ((($$4$lcssa$i)) + 16|0);
          $374 = HEAP32[$373>>2]|0;
          $375 = ($374|0)==(0|0);
          if ($375) {
           $$3372$i = 0;
           break;
          } else {
           $$1370$i = $374;$$1374$i = $373;
          }
         } else {
          $$1370$i = $371;$$1374$i = $370;
         }
         while(1) {
          $376 = ((($$1370$i)) + 20|0);
          $377 = HEAP32[$376>>2]|0;
          $378 = ($377|0)==(0|0);
          if (!($378)) {
           $$1370$i = $377;$$1374$i = $376;
           continue;
          }
          $379 = ((($$1370$i)) + 16|0);
          $380 = HEAP32[$379>>2]|0;
          $381 = ($380|0)==(0|0);
          if ($381) {
           break;
          } else {
           $$1370$i = $380;$$1374$i = $379;
          }
         }
         $382 = ($352>>>0)>($$1374$i>>>0);
         if ($382) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1374$i>>2] = 0;
          $$3372$i = $$1370$i;
          break;
         }
        } else {
         $361 = ((($$4$lcssa$i)) + 8|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($352>>>0)>($362>>>0);
         if ($363) {
          _abort();
          // unreachable;
         }
         $364 = ((($362)) + 12|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==($$4$lcssa$i|0);
         if (!($366)) {
          _abort();
          // unreachable;
         }
         $367 = ((($359)) + 8|0);
         $368 = HEAP32[$367>>2]|0;
         $369 = ($368|0)==($$4$lcssa$i|0);
         if ($369) {
          HEAP32[$364>>2] = $359;
          HEAP32[$367>>2] = $362;
          $$3372$i = $359;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $383 = ($357|0)==(0|0);
       L164: do {
        if ($383) {
         $475 = $253;
        } else {
         $384 = ((($$4$lcssa$i)) + 28|0);
         $385 = HEAP32[$384>>2]|0;
         $386 = (2904 + ($385<<2)|0);
         $387 = HEAP32[$386>>2]|0;
         $388 = ($$4$lcssa$i|0)==($387|0);
         do {
          if ($388) {
           HEAP32[$386>>2] = $$3372$i;
           $cond$i209 = ($$3372$i|0)==(0|0);
           if ($cond$i209) {
            $389 = 1 << $385;
            $390 = $389 ^ -1;
            $391 = $253 & $390;
            HEAP32[(2604)>>2] = $391;
            $475 = $391;
            break L164;
           }
          } else {
           $392 = HEAP32[(2616)>>2]|0;
           $393 = ($392>>>0)>($357>>>0);
           if ($393) {
            _abort();
            // unreachable;
           } else {
            $394 = ((($357)) + 16|0);
            $395 = HEAP32[$394>>2]|0;
            $396 = ($395|0)!=($$4$lcssa$i|0);
            $$sink3$i = $396&1;
            $397 = (((($357)) + 16|0) + ($$sink3$i<<2)|0);
            HEAP32[$397>>2] = $$3372$i;
            $398 = ($$3372$i|0)==(0|0);
            if ($398) {
             $475 = $253;
             break L164;
            } else {
             break;
            }
           }
          }
         } while(0);
         $399 = HEAP32[(2616)>>2]|0;
         $400 = ($399>>>0)>($$3372$i>>>0);
         if ($400) {
          _abort();
          // unreachable;
         }
         $401 = ((($$3372$i)) + 24|0);
         HEAP32[$401>>2] = $357;
         $402 = ((($$4$lcssa$i)) + 16|0);
         $403 = HEAP32[$402>>2]|0;
         $404 = ($403|0)==(0|0);
         do {
          if (!($404)) {
           $405 = ($399>>>0)>($403>>>0);
           if ($405) {
            _abort();
            // unreachable;
           } else {
            $406 = ((($$3372$i)) + 16|0);
            HEAP32[$406>>2] = $403;
            $407 = ((($403)) + 24|0);
            HEAP32[$407>>2] = $$3372$i;
            break;
           }
          }
         } while(0);
         $408 = ((($$4$lcssa$i)) + 20|0);
         $409 = HEAP32[$408>>2]|0;
         $410 = ($409|0)==(0|0);
         if ($410) {
          $475 = $253;
         } else {
          $411 = HEAP32[(2616)>>2]|0;
          $412 = ($411>>>0)>($409>>>0);
          if ($412) {
           _abort();
           // unreachable;
          } else {
           $413 = ((($$3372$i)) + 20|0);
           HEAP32[$413>>2] = $409;
           $414 = ((($409)) + 24|0);
           HEAP32[$414>>2] = $$3372$i;
           $475 = $253;
           break;
          }
         }
        }
       } while(0);
       $415 = ($$4351$lcssa$i>>>0)<(16);
       do {
        if ($415) {
         $416 = (($$4351$lcssa$i) + ($252))|0;
         $417 = $416 | 3;
         $418 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$418>>2] = $417;
         $419 = (($$4$lcssa$i) + ($416)|0);
         $420 = ((($419)) + 4|0);
         $421 = HEAP32[$420>>2]|0;
         $422 = $421 | 1;
         HEAP32[$420>>2] = $422;
        } else {
         $423 = $252 | 3;
         $424 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$424>>2] = $423;
         $425 = $$4351$lcssa$i | 1;
         $426 = ((($354)) + 4|0);
         HEAP32[$426>>2] = $425;
         $427 = (($354) + ($$4351$lcssa$i)|0);
         HEAP32[$427>>2] = $$4351$lcssa$i;
         $428 = $$4351$lcssa$i >>> 3;
         $429 = ($$4351$lcssa$i>>>0)<(256);
         if ($429) {
          $430 = $428 << 1;
          $431 = (2640 + ($430<<2)|0);
          $432 = HEAP32[650]|0;
          $433 = 1 << $428;
          $434 = $432 & $433;
          $435 = ($434|0)==(0);
          if ($435) {
           $436 = $432 | $433;
           HEAP32[650] = $436;
           $$pre$i210 = ((($431)) + 8|0);
           $$0368$i = $431;$$pre$phi$i211Z2D = $$pre$i210;
          } else {
           $437 = ((($431)) + 8|0);
           $438 = HEAP32[$437>>2]|0;
           $439 = HEAP32[(2616)>>2]|0;
           $440 = ($439>>>0)>($438>>>0);
           if ($440) {
            _abort();
            // unreachable;
           } else {
            $$0368$i = $438;$$pre$phi$i211Z2D = $437;
           }
          }
          HEAP32[$$pre$phi$i211Z2D>>2] = $354;
          $441 = ((($$0368$i)) + 12|0);
          HEAP32[$441>>2] = $354;
          $442 = ((($354)) + 8|0);
          HEAP32[$442>>2] = $$0368$i;
          $443 = ((($354)) + 12|0);
          HEAP32[$443>>2] = $431;
          break;
         }
         $444 = $$4351$lcssa$i >>> 8;
         $445 = ($444|0)==(0);
         if ($445) {
          $$0361$i = 0;
         } else {
          $446 = ($$4351$lcssa$i>>>0)>(16777215);
          if ($446) {
           $$0361$i = 31;
          } else {
           $447 = (($444) + 1048320)|0;
           $448 = $447 >>> 16;
           $449 = $448 & 8;
           $450 = $444 << $449;
           $451 = (($450) + 520192)|0;
           $452 = $451 >>> 16;
           $453 = $452 & 4;
           $454 = $453 | $449;
           $455 = $450 << $453;
           $456 = (($455) + 245760)|0;
           $457 = $456 >>> 16;
           $458 = $457 & 2;
           $459 = $454 | $458;
           $460 = (14 - ($459))|0;
           $461 = $455 << $458;
           $462 = $461 >>> 15;
           $463 = (($460) + ($462))|0;
           $464 = $463 << 1;
           $465 = (($463) + 7)|0;
           $466 = $$4351$lcssa$i >>> $465;
           $467 = $466 & 1;
           $468 = $467 | $464;
           $$0361$i = $468;
          }
         }
         $469 = (2904 + ($$0361$i<<2)|0);
         $470 = ((($354)) + 28|0);
         HEAP32[$470>>2] = $$0361$i;
         $471 = ((($354)) + 16|0);
         $472 = ((($471)) + 4|0);
         HEAP32[$472>>2] = 0;
         HEAP32[$471>>2] = 0;
         $473 = 1 << $$0361$i;
         $474 = $475 & $473;
         $476 = ($474|0)==(0);
         if ($476) {
          $477 = $475 | $473;
          HEAP32[(2604)>>2] = $477;
          HEAP32[$469>>2] = $354;
          $478 = ((($354)) + 24|0);
          HEAP32[$478>>2] = $469;
          $479 = ((($354)) + 12|0);
          HEAP32[$479>>2] = $354;
          $480 = ((($354)) + 8|0);
          HEAP32[$480>>2] = $354;
          break;
         }
         $481 = HEAP32[$469>>2]|0;
         $482 = ($$0361$i|0)==(31);
         $483 = $$0361$i >>> 1;
         $484 = (25 - ($483))|0;
         $485 = $482 ? 0 : $484;
         $486 = $$4351$lcssa$i << $485;
         $$0344$i = $486;$$0345$i = $481;
         while(1) {
          $487 = ((($$0345$i)) + 4|0);
          $488 = HEAP32[$487>>2]|0;
          $489 = $488 & -8;
          $490 = ($489|0)==($$4351$lcssa$i|0);
          if ($490) {
           label = 139;
           break;
          }
          $491 = $$0344$i >>> 31;
          $492 = (((($$0345$i)) + 16|0) + ($491<<2)|0);
          $493 = $$0344$i << 1;
          $494 = HEAP32[$492>>2]|0;
          $495 = ($494|0)==(0|0);
          if ($495) {
           label = 136;
           break;
          } else {
           $$0344$i = $493;$$0345$i = $494;
          }
         }
         if ((label|0) == 136) {
          $496 = HEAP32[(2616)>>2]|0;
          $497 = ($496>>>0)>($492>>>0);
          if ($497) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$492>>2] = $354;
           $498 = ((($354)) + 24|0);
           HEAP32[$498>>2] = $$0345$i;
           $499 = ((($354)) + 12|0);
           HEAP32[$499>>2] = $354;
           $500 = ((($354)) + 8|0);
           HEAP32[$500>>2] = $354;
           break;
          }
         }
         else if ((label|0) == 139) {
          $501 = ((($$0345$i)) + 8|0);
          $502 = HEAP32[$501>>2]|0;
          $503 = HEAP32[(2616)>>2]|0;
          $504 = ($503>>>0)<=($$0345$i>>>0);
          $505 = ($503>>>0)<=($502>>>0);
          $506 = $505 & $504;
          if ($506) {
           $507 = ((($502)) + 12|0);
           HEAP32[$507>>2] = $354;
           HEAP32[$501>>2] = $354;
           $508 = ((($354)) + 8|0);
           HEAP32[$508>>2] = $502;
           $509 = ((($354)) + 12|0);
           HEAP32[$509>>2] = $$0345$i;
           $510 = ((($354)) + 24|0);
           HEAP32[$510>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $511 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $511;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $252;
      }
     }
    }
   }
  }
 } while(0);
 $512 = HEAP32[(2608)>>2]|0;
 $513 = ($512>>>0)<($$0197>>>0);
 if (!($513)) {
  $514 = (($512) - ($$0197))|0;
  $515 = HEAP32[(2620)>>2]|0;
  $516 = ($514>>>0)>(15);
  if ($516) {
   $517 = (($515) + ($$0197)|0);
   HEAP32[(2620)>>2] = $517;
   HEAP32[(2608)>>2] = $514;
   $518 = $514 | 1;
   $519 = ((($517)) + 4|0);
   HEAP32[$519>>2] = $518;
   $520 = (($515) + ($512)|0);
   HEAP32[$520>>2] = $514;
   $521 = $$0197 | 3;
   $522 = ((($515)) + 4|0);
   HEAP32[$522>>2] = $521;
  } else {
   HEAP32[(2608)>>2] = 0;
   HEAP32[(2620)>>2] = 0;
   $523 = $512 | 3;
   $524 = ((($515)) + 4|0);
   HEAP32[$524>>2] = $523;
   $525 = (($515) + ($512)|0);
   $526 = ((($525)) + 4|0);
   $527 = HEAP32[$526>>2]|0;
   $528 = $527 | 1;
   HEAP32[$526>>2] = $528;
  }
  $529 = ((($515)) + 8|0);
  $$0 = $529;
  STACKTOP = sp;return ($$0|0);
 }
 $530 = HEAP32[(2612)>>2]|0;
 $531 = ($530>>>0)>($$0197>>>0);
 if ($531) {
  $532 = (($530) - ($$0197))|0;
  HEAP32[(2612)>>2] = $532;
  $533 = HEAP32[(2624)>>2]|0;
  $534 = (($533) + ($$0197)|0);
  HEAP32[(2624)>>2] = $534;
  $535 = $532 | 1;
  $536 = ((($534)) + 4|0);
  HEAP32[$536>>2] = $535;
  $537 = $$0197 | 3;
  $538 = ((($533)) + 4|0);
  HEAP32[$538>>2] = $537;
  $539 = ((($533)) + 8|0);
  $$0 = $539;
  STACKTOP = sp;return ($$0|0);
 }
 $540 = HEAP32[768]|0;
 $541 = ($540|0)==(0);
 if ($541) {
  HEAP32[(3080)>>2] = 4096;
  HEAP32[(3076)>>2] = 4096;
  HEAP32[(3084)>>2] = -1;
  HEAP32[(3088)>>2] = -1;
  HEAP32[(3092)>>2] = 0;
  HEAP32[(3044)>>2] = 0;
  $542 = $1;
  $543 = $542 & -16;
  $544 = $543 ^ 1431655768;
  HEAP32[768] = $544;
  $548 = 4096;
 } else {
  $$pre$i212 = HEAP32[(3080)>>2]|0;
  $548 = $$pre$i212;
 }
 $545 = (($$0197) + 48)|0;
 $546 = (($$0197) + 47)|0;
 $547 = (($548) + ($546))|0;
 $549 = (0 - ($548))|0;
 $550 = $547 & $549;
 $551 = ($550>>>0)>($$0197>>>0);
 if (!($551)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $552 = HEAP32[(3040)>>2]|0;
 $553 = ($552|0)==(0);
 if (!($553)) {
  $554 = HEAP32[(3032)>>2]|0;
  $555 = (($554) + ($550))|0;
  $556 = ($555>>>0)<=($554>>>0);
  $557 = ($555>>>0)>($552>>>0);
  $or$cond1$i = $556 | $557;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $558 = HEAP32[(3044)>>2]|0;
 $559 = $558 & 4;
 $560 = ($559|0)==(0);
 L244: do {
  if ($560) {
   $561 = HEAP32[(2624)>>2]|0;
   $562 = ($561|0)==(0|0);
   L246: do {
    if ($562) {
     label = 163;
    } else {
     $$0$i$i = (3048);
     while(1) {
      $563 = HEAP32[$$0$i$i>>2]|0;
      $564 = ($563>>>0)>($561>>>0);
      if (!($564)) {
       $565 = ((($$0$i$i)) + 4|0);
       $566 = HEAP32[$565>>2]|0;
       $567 = (($563) + ($566)|0);
       $568 = ($567>>>0)>($561>>>0);
       if ($568) {
        break;
       }
      }
      $569 = ((($$0$i$i)) + 8|0);
      $570 = HEAP32[$569>>2]|0;
      $571 = ($570|0)==(0|0);
      if ($571) {
       label = 163;
       break L246;
      } else {
       $$0$i$i = $570;
      }
     }
     $594 = (($547) - ($530))|0;
     $595 = $594 & $549;
     $596 = ($595>>>0)<(2147483647);
     if ($596) {
      $597 = (_sbrk(($595|0))|0);
      $598 = HEAP32[$$0$i$i>>2]|0;
      $599 = HEAP32[$565>>2]|0;
      $600 = (($598) + ($599)|0);
      $601 = ($597|0)==($600|0);
      if ($601) {
       $602 = ($597|0)==((-1)|0);
       if ($602) {
        $$2234243136$i = $595;
       } else {
        $$723947$i = $595;$$748$i = $597;
        label = 180;
        break L244;
       }
      } else {
       $$2247$ph$i = $597;$$2253$ph$i = $595;
       label = 171;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 163) {
     $572 = (_sbrk(0)|0);
     $573 = ($572|0)==((-1)|0);
     if ($573) {
      $$2234243136$i = 0;
     } else {
      $574 = $572;
      $575 = HEAP32[(3076)>>2]|0;
      $576 = (($575) + -1)|0;
      $577 = $576 & $574;
      $578 = ($577|0)==(0);
      $579 = (($576) + ($574))|0;
      $580 = (0 - ($575))|0;
      $581 = $579 & $580;
      $582 = (($581) - ($574))|0;
      $583 = $578 ? 0 : $582;
      $$$i = (($583) + ($550))|0;
      $584 = HEAP32[(3032)>>2]|0;
      $585 = (($$$i) + ($584))|0;
      $586 = ($$$i>>>0)>($$0197>>>0);
      $587 = ($$$i>>>0)<(2147483647);
      $or$cond$i214 = $586 & $587;
      if ($or$cond$i214) {
       $588 = HEAP32[(3040)>>2]|0;
       $589 = ($588|0)==(0);
       if (!($589)) {
        $590 = ($585>>>0)<=($584>>>0);
        $591 = ($585>>>0)>($588>>>0);
        $or$cond2$i215 = $590 | $591;
        if ($or$cond2$i215) {
         $$2234243136$i = 0;
         break;
        }
       }
       $592 = (_sbrk(($$$i|0))|0);
       $593 = ($592|0)==($572|0);
       if ($593) {
        $$723947$i = $$$i;$$748$i = $572;
        label = 180;
        break L244;
       } else {
        $$2247$ph$i = $592;$$2253$ph$i = $$$i;
        label = 171;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 171) {
     $603 = (0 - ($$2253$ph$i))|0;
     $604 = ($$2247$ph$i|0)!=((-1)|0);
     $605 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $605 & $604;
     $606 = ($545>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $606 & $or$cond7$i;
     if (!($or$cond10$i)) {
      $616 = ($$2247$ph$i|0)==((-1)|0);
      if ($616) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 180;
       break L244;
      }
     }
     $607 = HEAP32[(3080)>>2]|0;
     $608 = (($546) - ($$2253$ph$i))|0;
     $609 = (($608) + ($607))|0;
     $610 = (0 - ($607))|0;
     $611 = $609 & $610;
     $612 = ($611>>>0)<(2147483647);
     if (!($612)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 180;
      break L244;
     }
     $613 = (_sbrk(($611|0))|0);
     $614 = ($613|0)==((-1)|0);
     if ($614) {
      (_sbrk(($603|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $615 = (($611) + ($$2253$ph$i))|0;
      $$723947$i = $615;$$748$i = $$2247$ph$i;
      label = 180;
      break L244;
     }
    }
   } while(0);
   $617 = HEAP32[(3044)>>2]|0;
   $618 = $617 | 4;
   HEAP32[(3044)>>2] = $618;
   $$4236$i = $$2234243136$i;
   label = 178;
  } else {
   $$4236$i = 0;
   label = 178;
  }
 } while(0);
 if ((label|0) == 178) {
  $619 = ($550>>>0)<(2147483647);
  if ($619) {
   $620 = (_sbrk(($550|0))|0);
   $621 = (_sbrk(0)|0);
   $622 = ($620|0)!=((-1)|0);
   $623 = ($621|0)!=((-1)|0);
   $or$cond5$i = $622 & $623;
   $624 = ($620>>>0)<($621>>>0);
   $or$cond11$i = $624 & $or$cond5$i;
   $625 = $621;
   $626 = $620;
   $627 = (($625) - ($626))|0;
   $628 = (($$0197) + 40)|0;
   $629 = ($627>>>0)>($628>>>0);
   $$$4236$i = $629 ? $627 : $$4236$i;
   $or$cond11$not$i = $or$cond11$i ^ 1;
   $630 = ($620|0)==((-1)|0);
   $not$$i = $629 ^ 1;
   $631 = $630 | $not$$i;
   $or$cond49$i = $631 | $or$cond11$not$i;
   if (!($or$cond49$i)) {
    $$723947$i = $$$4236$i;$$748$i = $620;
    label = 180;
   }
  }
 }
 if ((label|0) == 180) {
  $632 = HEAP32[(3032)>>2]|0;
  $633 = (($632) + ($$723947$i))|0;
  HEAP32[(3032)>>2] = $633;
  $634 = HEAP32[(3036)>>2]|0;
  $635 = ($633>>>0)>($634>>>0);
  if ($635) {
   HEAP32[(3036)>>2] = $633;
  }
  $636 = HEAP32[(2624)>>2]|0;
  $637 = ($636|0)==(0|0);
  do {
   if ($637) {
    $638 = HEAP32[(2616)>>2]|0;
    $639 = ($638|0)==(0|0);
    $640 = ($$748$i>>>0)<($638>>>0);
    $or$cond12$i = $639 | $640;
    if ($or$cond12$i) {
     HEAP32[(2616)>>2] = $$748$i;
    }
    HEAP32[(3048)>>2] = $$748$i;
    HEAP32[(3052)>>2] = $$723947$i;
    HEAP32[(3060)>>2] = 0;
    $641 = HEAP32[768]|0;
    HEAP32[(2636)>>2] = $641;
    HEAP32[(2632)>>2] = -1;
    HEAP32[(2652)>>2] = (2640);
    HEAP32[(2648)>>2] = (2640);
    HEAP32[(2660)>>2] = (2648);
    HEAP32[(2656)>>2] = (2648);
    HEAP32[(2668)>>2] = (2656);
    HEAP32[(2664)>>2] = (2656);
    HEAP32[(2676)>>2] = (2664);
    HEAP32[(2672)>>2] = (2664);
    HEAP32[(2684)>>2] = (2672);
    HEAP32[(2680)>>2] = (2672);
    HEAP32[(2692)>>2] = (2680);
    HEAP32[(2688)>>2] = (2680);
    HEAP32[(2700)>>2] = (2688);
    HEAP32[(2696)>>2] = (2688);
    HEAP32[(2708)>>2] = (2696);
    HEAP32[(2704)>>2] = (2696);
    HEAP32[(2716)>>2] = (2704);
    HEAP32[(2712)>>2] = (2704);
    HEAP32[(2724)>>2] = (2712);
    HEAP32[(2720)>>2] = (2712);
    HEAP32[(2732)>>2] = (2720);
    HEAP32[(2728)>>2] = (2720);
    HEAP32[(2740)>>2] = (2728);
    HEAP32[(2736)>>2] = (2728);
    HEAP32[(2748)>>2] = (2736);
    HEAP32[(2744)>>2] = (2736);
    HEAP32[(2756)>>2] = (2744);
    HEAP32[(2752)>>2] = (2744);
    HEAP32[(2764)>>2] = (2752);
    HEAP32[(2760)>>2] = (2752);
    HEAP32[(2772)>>2] = (2760);
    HEAP32[(2768)>>2] = (2760);
    HEAP32[(2780)>>2] = (2768);
    HEAP32[(2776)>>2] = (2768);
    HEAP32[(2788)>>2] = (2776);
    HEAP32[(2784)>>2] = (2776);
    HEAP32[(2796)>>2] = (2784);
    HEAP32[(2792)>>2] = (2784);
    HEAP32[(2804)>>2] = (2792);
    HEAP32[(2800)>>2] = (2792);
    HEAP32[(2812)>>2] = (2800);
    HEAP32[(2808)>>2] = (2800);
    HEAP32[(2820)>>2] = (2808);
    HEAP32[(2816)>>2] = (2808);
    HEAP32[(2828)>>2] = (2816);
    HEAP32[(2824)>>2] = (2816);
    HEAP32[(2836)>>2] = (2824);
    HEAP32[(2832)>>2] = (2824);
    HEAP32[(2844)>>2] = (2832);
    HEAP32[(2840)>>2] = (2832);
    HEAP32[(2852)>>2] = (2840);
    HEAP32[(2848)>>2] = (2840);
    HEAP32[(2860)>>2] = (2848);
    HEAP32[(2856)>>2] = (2848);
    HEAP32[(2868)>>2] = (2856);
    HEAP32[(2864)>>2] = (2856);
    HEAP32[(2876)>>2] = (2864);
    HEAP32[(2872)>>2] = (2864);
    HEAP32[(2884)>>2] = (2872);
    HEAP32[(2880)>>2] = (2872);
    HEAP32[(2892)>>2] = (2880);
    HEAP32[(2888)>>2] = (2880);
    HEAP32[(2900)>>2] = (2888);
    HEAP32[(2896)>>2] = (2888);
    $642 = (($$723947$i) + -40)|0;
    $643 = ((($$748$i)) + 8|0);
    $644 = $643;
    $645 = $644 & 7;
    $646 = ($645|0)==(0);
    $647 = (0 - ($644))|0;
    $648 = $647 & 7;
    $649 = $646 ? 0 : $648;
    $650 = (($$748$i) + ($649)|0);
    $651 = (($642) - ($649))|0;
    HEAP32[(2624)>>2] = $650;
    HEAP32[(2612)>>2] = $651;
    $652 = $651 | 1;
    $653 = ((($650)) + 4|0);
    HEAP32[$653>>2] = $652;
    $654 = (($$748$i) + ($642)|0);
    $655 = ((($654)) + 4|0);
    HEAP32[$655>>2] = 40;
    $656 = HEAP32[(3088)>>2]|0;
    HEAP32[(2628)>>2] = $656;
   } else {
    $$024367$i = (3048);
    while(1) {
     $657 = HEAP32[$$024367$i>>2]|0;
     $658 = ((($$024367$i)) + 4|0);
     $659 = HEAP32[$658>>2]|0;
     $660 = (($657) + ($659)|0);
     $661 = ($$748$i|0)==($660|0);
     if ($661) {
      label = 188;
      break;
     }
     $662 = ((($$024367$i)) + 8|0);
     $663 = HEAP32[$662>>2]|0;
     $664 = ($663|0)==(0|0);
     if ($664) {
      break;
     } else {
      $$024367$i = $663;
     }
    }
    if ((label|0) == 188) {
     $665 = ((($$024367$i)) + 12|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = $666 & 8;
     $668 = ($667|0)==(0);
     if ($668) {
      $669 = ($657>>>0)<=($636>>>0);
      $670 = ($$748$i>>>0)>($636>>>0);
      $or$cond50$i = $670 & $669;
      if ($or$cond50$i) {
       $671 = (($659) + ($$723947$i))|0;
       HEAP32[$658>>2] = $671;
       $672 = HEAP32[(2612)>>2]|0;
       $673 = (($672) + ($$723947$i))|0;
       $674 = ((($636)) + 8|0);
       $675 = $674;
       $676 = $675 & 7;
       $677 = ($676|0)==(0);
       $678 = (0 - ($675))|0;
       $679 = $678 & 7;
       $680 = $677 ? 0 : $679;
       $681 = (($636) + ($680)|0);
       $682 = (($673) - ($680))|0;
       HEAP32[(2624)>>2] = $681;
       HEAP32[(2612)>>2] = $682;
       $683 = $682 | 1;
       $684 = ((($681)) + 4|0);
       HEAP32[$684>>2] = $683;
       $685 = (($636) + ($673)|0);
       $686 = ((($685)) + 4|0);
       HEAP32[$686>>2] = 40;
       $687 = HEAP32[(3088)>>2]|0;
       HEAP32[(2628)>>2] = $687;
       break;
      }
     }
    }
    $688 = HEAP32[(2616)>>2]|0;
    $689 = ($$748$i>>>0)<($688>>>0);
    if ($689) {
     HEAP32[(2616)>>2] = $$748$i;
     $752 = $$748$i;
    } else {
     $752 = $688;
    }
    $690 = (($$748$i) + ($$723947$i)|0);
    $$124466$i = (3048);
    while(1) {
     $691 = HEAP32[$$124466$i>>2]|0;
     $692 = ($691|0)==($690|0);
     if ($692) {
      label = 196;
      break;
     }
     $693 = ((($$124466$i)) + 8|0);
     $694 = HEAP32[$693>>2]|0;
     $695 = ($694|0)==(0|0);
     if ($695) {
      $$0$i$i$i = (3048);
      break;
     } else {
      $$124466$i = $694;
     }
    }
    if ((label|0) == 196) {
     $696 = ((($$124466$i)) + 12|0);
     $697 = HEAP32[$696>>2]|0;
     $698 = $697 & 8;
     $699 = ($698|0)==(0);
     if ($699) {
      HEAP32[$$124466$i>>2] = $$748$i;
      $700 = ((($$124466$i)) + 4|0);
      $701 = HEAP32[$700>>2]|0;
      $702 = (($701) + ($$723947$i))|0;
      HEAP32[$700>>2] = $702;
      $703 = ((($$748$i)) + 8|0);
      $704 = $703;
      $705 = $704 & 7;
      $706 = ($705|0)==(0);
      $707 = (0 - ($704))|0;
      $708 = $707 & 7;
      $709 = $706 ? 0 : $708;
      $710 = (($$748$i) + ($709)|0);
      $711 = ((($690)) + 8|0);
      $712 = $711;
      $713 = $712 & 7;
      $714 = ($713|0)==(0);
      $715 = (0 - ($712))|0;
      $716 = $715 & 7;
      $717 = $714 ? 0 : $716;
      $718 = (($690) + ($717)|0);
      $719 = $718;
      $720 = $710;
      $721 = (($719) - ($720))|0;
      $722 = (($710) + ($$0197)|0);
      $723 = (($721) - ($$0197))|0;
      $724 = $$0197 | 3;
      $725 = ((($710)) + 4|0);
      HEAP32[$725>>2] = $724;
      $726 = ($636|0)==($718|0);
      do {
       if ($726) {
        $727 = HEAP32[(2612)>>2]|0;
        $728 = (($727) + ($723))|0;
        HEAP32[(2612)>>2] = $728;
        HEAP32[(2624)>>2] = $722;
        $729 = $728 | 1;
        $730 = ((($722)) + 4|0);
        HEAP32[$730>>2] = $729;
       } else {
        $731 = HEAP32[(2620)>>2]|0;
        $732 = ($731|0)==($718|0);
        if ($732) {
         $733 = HEAP32[(2608)>>2]|0;
         $734 = (($733) + ($723))|0;
         HEAP32[(2608)>>2] = $734;
         HEAP32[(2620)>>2] = $722;
         $735 = $734 | 1;
         $736 = ((($722)) + 4|0);
         HEAP32[$736>>2] = $735;
         $737 = (($722) + ($734)|0);
         HEAP32[$737>>2] = $734;
         break;
        }
        $738 = ((($718)) + 4|0);
        $739 = HEAP32[$738>>2]|0;
        $740 = $739 & 3;
        $741 = ($740|0)==(1);
        if ($741) {
         $742 = $739 & -8;
         $743 = $739 >>> 3;
         $744 = ($739>>>0)<(256);
         L311: do {
          if ($744) {
           $745 = ((($718)) + 8|0);
           $746 = HEAP32[$745>>2]|0;
           $747 = ((($718)) + 12|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = $743 << 1;
           $750 = (2640 + ($749<<2)|0);
           $751 = ($746|0)==($750|0);
           do {
            if (!($751)) {
             $753 = ($752>>>0)>($746>>>0);
             if ($753) {
              _abort();
              // unreachable;
             }
             $754 = ((($746)) + 12|0);
             $755 = HEAP32[$754>>2]|0;
             $756 = ($755|0)==($718|0);
             if ($756) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $757 = ($748|0)==($746|0);
           if ($757) {
            $758 = 1 << $743;
            $759 = $758 ^ -1;
            $760 = HEAP32[650]|0;
            $761 = $760 & $759;
            HEAP32[650] = $761;
            break;
           }
           $762 = ($748|0)==($750|0);
           do {
            if ($762) {
             $$pre10$i$i = ((($748)) + 8|0);
             $$pre$phi11$i$iZ2D = $$pre10$i$i;
            } else {
             $763 = ($752>>>0)>($748>>>0);
             if ($763) {
              _abort();
              // unreachable;
             }
             $764 = ((($748)) + 8|0);
             $765 = HEAP32[$764>>2]|0;
             $766 = ($765|0)==($718|0);
             if ($766) {
              $$pre$phi11$i$iZ2D = $764;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $767 = ((($746)) + 12|0);
           HEAP32[$767>>2] = $748;
           HEAP32[$$pre$phi11$i$iZ2D>>2] = $746;
          } else {
           $768 = ((($718)) + 24|0);
           $769 = HEAP32[$768>>2]|0;
           $770 = ((($718)) + 12|0);
           $771 = HEAP32[$770>>2]|0;
           $772 = ($771|0)==($718|0);
           do {
            if ($772) {
             $782 = ((($718)) + 16|0);
             $783 = ((($782)) + 4|0);
             $784 = HEAP32[$783>>2]|0;
             $785 = ($784|0)==(0|0);
             if ($785) {
              $786 = HEAP32[$782>>2]|0;
              $787 = ($786|0)==(0|0);
              if ($787) {
               $$3$i$i = 0;
               break;
              } else {
               $$1291$i$i = $786;$$1293$i$i = $782;
              }
             } else {
              $$1291$i$i = $784;$$1293$i$i = $783;
             }
             while(1) {
              $788 = ((($$1291$i$i)) + 20|0);
              $789 = HEAP32[$788>>2]|0;
              $790 = ($789|0)==(0|0);
              if (!($790)) {
               $$1291$i$i = $789;$$1293$i$i = $788;
               continue;
              }
              $791 = ((($$1291$i$i)) + 16|0);
              $792 = HEAP32[$791>>2]|0;
              $793 = ($792|0)==(0|0);
              if ($793) {
               break;
              } else {
               $$1291$i$i = $792;$$1293$i$i = $791;
              }
             }
             $794 = ($752>>>0)>($$1293$i$i>>>0);
             if ($794) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1293$i$i>>2] = 0;
              $$3$i$i = $$1291$i$i;
              break;
             }
            } else {
             $773 = ((($718)) + 8|0);
             $774 = HEAP32[$773>>2]|0;
             $775 = ($752>>>0)>($774>>>0);
             if ($775) {
              _abort();
              // unreachable;
             }
             $776 = ((($774)) + 12|0);
             $777 = HEAP32[$776>>2]|0;
             $778 = ($777|0)==($718|0);
             if (!($778)) {
              _abort();
              // unreachable;
             }
             $779 = ((($771)) + 8|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==($718|0);
             if ($781) {
              HEAP32[$776>>2] = $771;
              HEAP32[$779>>2] = $774;
              $$3$i$i = $771;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $795 = ($769|0)==(0|0);
           if ($795) {
            break;
           }
           $796 = ((($718)) + 28|0);
           $797 = HEAP32[$796>>2]|0;
           $798 = (2904 + ($797<<2)|0);
           $799 = HEAP32[$798>>2]|0;
           $800 = ($799|0)==($718|0);
           do {
            if ($800) {
             HEAP32[$798>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $801 = 1 << $797;
             $802 = $801 ^ -1;
             $803 = HEAP32[(2604)>>2]|0;
             $804 = $803 & $802;
             HEAP32[(2604)>>2] = $804;
             break L311;
            } else {
             $805 = HEAP32[(2616)>>2]|0;
             $806 = ($805>>>0)>($769>>>0);
             if ($806) {
              _abort();
              // unreachable;
             } else {
              $807 = ((($769)) + 16|0);
              $808 = HEAP32[$807>>2]|0;
              $809 = ($808|0)!=($718|0);
              $$sink1$i$i = $809&1;
              $810 = (((($769)) + 16|0) + ($$sink1$i$i<<2)|0);
              HEAP32[$810>>2] = $$3$i$i;
              $811 = ($$3$i$i|0)==(0|0);
              if ($811) {
               break L311;
              } else {
               break;
              }
             }
            }
           } while(0);
           $812 = HEAP32[(2616)>>2]|0;
           $813 = ($812>>>0)>($$3$i$i>>>0);
           if ($813) {
            _abort();
            // unreachable;
           }
           $814 = ((($$3$i$i)) + 24|0);
           HEAP32[$814>>2] = $769;
           $815 = ((($718)) + 16|0);
           $816 = HEAP32[$815>>2]|0;
           $817 = ($816|0)==(0|0);
           do {
            if (!($817)) {
             $818 = ($812>>>0)>($816>>>0);
             if ($818) {
              _abort();
              // unreachable;
             } else {
              $819 = ((($$3$i$i)) + 16|0);
              HEAP32[$819>>2] = $816;
              $820 = ((($816)) + 24|0);
              HEAP32[$820>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $821 = ((($815)) + 4|0);
           $822 = HEAP32[$821>>2]|0;
           $823 = ($822|0)==(0|0);
           if ($823) {
            break;
           }
           $824 = HEAP32[(2616)>>2]|0;
           $825 = ($824>>>0)>($822>>>0);
           if ($825) {
            _abort();
            // unreachable;
           } else {
            $826 = ((($$3$i$i)) + 20|0);
            HEAP32[$826>>2] = $822;
            $827 = ((($822)) + 24|0);
            HEAP32[$827>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $828 = (($718) + ($742)|0);
         $829 = (($742) + ($723))|0;
         $$0$i17$i = $828;$$0287$i$i = $829;
        } else {
         $$0$i17$i = $718;$$0287$i$i = $723;
        }
        $830 = ((($$0$i17$i)) + 4|0);
        $831 = HEAP32[$830>>2]|0;
        $832 = $831 & -2;
        HEAP32[$830>>2] = $832;
        $833 = $$0287$i$i | 1;
        $834 = ((($722)) + 4|0);
        HEAP32[$834>>2] = $833;
        $835 = (($722) + ($$0287$i$i)|0);
        HEAP32[$835>>2] = $$0287$i$i;
        $836 = $$0287$i$i >>> 3;
        $837 = ($$0287$i$i>>>0)<(256);
        if ($837) {
         $838 = $836 << 1;
         $839 = (2640 + ($838<<2)|0);
         $840 = HEAP32[650]|0;
         $841 = 1 << $836;
         $842 = $840 & $841;
         $843 = ($842|0)==(0);
         do {
          if ($843) {
           $844 = $840 | $841;
           HEAP32[650] = $844;
           $$pre$i18$i = ((($839)) + 8|0);
           $$0295$i$i = $839;$$pre$phi$i19$iZ2D = $$pre$i18$i;
          } else {
           $845 = ((($839)) + 8|0);
           $846 = HEAP32[$845>>2]|0;
           $847 = HEAP32[(2616)>>2]|0;
           $848 = ($847>>>0)>($846>>>0);
           if (!($848)) {
            $$0295$i$i = $846;$$pre$phi$i19$iZ2D = $845;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i19$iZ2D>>2] = $722;
         $849 = ((($$0295$i$i)) + 12|0);
         HEAP32[$849>>2] = $722;
         $850 = ((($722)) + 8|0);
         HEAP32[$850>>2] = $$0295$i$i;
         $851 = ((($722)) + 12|0);
         HEAP32[$851>>2] = $839;
         break;
        }
        $852 = $$0287$i$i >>> 8;
        $853 = ($852|0)==(0);
        do {
         if ($853) {
          $$0296$i$i = 0;
         } else {
          $854 = ($$0287$i$i>>>0)>(16777215);
          if ($854) {
           $$0296$i$i = 31;
           break;
          }
          $855 = (($852) + 1048320)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 8;
          $858 = $852 << $857;
          $859 = (($858) + 520192)|0;
          $860 = $859 >>> 16;
          $861 = $860 & 4;
          $862 = $861 | $857;
          $863 = $858 << $861;
          $864 = (($863) + 245760)|0;
          $865 = $864 >>> 16;
          $866 = $865 & 2;
          $867 = $862 | $866;
          $868 = (14 - ($867))|0;
          $869 = $863 << $866;
          $870 = $869 >>> 15;
          $871 = (($868) + ($870))|0;
          $872 = $871 << 1;
          $873 = (($871) + 7)|0;
          $874 = $$0287$i$i >>> $873;
          $875 = $874 & 1;
          $876 = $875 | $872;
          $$0296$i$i = $876;
         }
        } while(0);
        $877 = (2904 + ($$0296$i$i<<2)|0);
        $878 = ((($722)) + 28|0);
        HEAP32[$878>>2] = $$0296$i$i;
        $879 = ((($722)) + 16|0);
        $880 = ((($879)) + 4|0);
        HEAP32[$880>>2] = 0;
        HEAP32[$879>>2] = 0;
        $881 = HEAP32[(2604)>>2]|0;
        $882 = 1 << $$0296$i$i;
        $883 = $881 & $882;
        $884 = ($883|0)==(0);
        if ($884) {
         $885 = $881 | $882;
         HEAP32[(2604)>>2] = $885;
         HEAP32[$877>>2] = $722;
         $886 = ((($722)) + 24|0);
         HEAP32[$886>>2] = $877;
         $887 = ((($722)) + 12|0);
         HEAP32[$887>>2] = $722;
         $888 = ((($722)) + 8|0);
         HEAP32[$888>>2] = $722;
         break;
        }
        $889 = HEAP32[$877>>2]|0;
        $890 = ($$0296$i$i|0)==(31);
        $891 = $$0296$i$i >>> 1;
        $892 = (25 - ($891))|0;
        $893 = $890 ? 0 : $892;
        $894 = $$0287$i$i << $893;
        $$0288$i$i = $894;$$0289$i$i = $889;
        while(1) {
         $895 = ((($$0289$i$i)) + 4|0);
         $896 = HEAP32[$895>>2]|0;
         $897 = $896 & -8;
         $898 = ($897|0)==($$0287$i$i|0);
         if ($898) {
          label = 263;
          break;
         }
         $899 = $$0288$i$i >>> 31;
         $900 = (((($$0289$i$i)) + 16|0) + ($899<<2)|0);
         $901 = $$0288$i$i << 1;
         $902 = HEAP32[$900>>2]|0;
         $903 = ($902|0)==(0|0);
         if ($903) {
          label = 260;
          break;
         } else {
          $$0288$i$i = $901;$$0289$i$i = $902;
         }
        }
        if ((label|0) == 260) {
         $904 = HEAP32[(2616)>>2]|0;
         $905 = ($904>>>0)>($900>>>0);
         if ($905) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$900>>2] = $722;
          $906 = ((($722)) + 24|0);
          HEAP32[$906>>2] = $$0289$i$i;
          $907 = ((($722)) + 12|0);
          HEAP32[$907>>2] = $722;
          $908 = ((($722)) + 8|0);
          HEAP32[$908>>2] = $722;
          break;
         }
        }
        else if ((label|0) == 263) {
         $909 = ((($$0289$i$i)) + 8|0);
         $910 = HEAP32[$909>>2]|0;
         $911 = HEAP32[(2616)>>2]|0;
         $912 = ($911>>>0)<=($$0289$i$i>>>0);
         $913 = ($911>>>0)<=($910>>>0);
         $914 = $913 & $912;
         if ($914) {
          $915 = ((($910)) + 12|0);
          HEAP32[$915>>2] = $722;
          HEAP32[$909>>2] = $722;
          $916 = ((($722)) + 8|0);
          HEAP32[$916>>2] = $910;
          $917 = ((($722)) + 12|0);
          HEAP32[$917>>2] = $$0289$i$i;
          $918 = ((($722)) + 24|0);
          HEAP32[$918>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1051 = ((($710)) + 8|0);
      $$0 = $1051;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0$i$i$i = (3048);
     }
    }
    while(1) {
     $919 = HEAP32[$$0$i$i$i>>2]|0;
     $920 = ($919>>>0)>($636>>>0);
     if (!($920)) {
      $921 = ((($$0$i$i$i)) + 4|0);
      $922 = HEAP32[$921>>2]|0;
      $923 = (($919) + ($922)|0);
      $924 = ($923>>>0)>($636>>>0);
      if ($924) {
       break;
      }
     }
     $925 = ((($$0$i$i$i)) + 8|0);
     $926 = HEAP32[$925>>2]|0;
     $$0$i$i$i = $926;
    }
    $927 = ((($923)) + -47|0);
    $928 = ((($927)) + 8|0);
    $929 = $928;
    $930 = $929 & 7;
    $931 = ($930|0)==(0);
    $932 = (0 - ($929))|0;
    $933 = $932 & 7;
    $934 = $931 ? 0 : $933;
    $935 = (($927) + ($934)|0);
    $936 = ((($636)) + 16|0);
    $937 = ($935>>>0)<($936>>>0);
    $938 = $937 ? $636 : $935;
    $939 = ((($938)) + 8|0);
    $940 = ((($938)) + 24|0);
    $941 = (($$723947$i) + -40)|0;
    $942 = ((($$748$i)) + 8|0);
    $943 = $942;
    $944 = $943 & 7;
    $945 = ($944|0)==(0);
    $946 = (0 - ($943))|0;
    $947 = $946 & 7;
    $948 = $945 ? 0 : $947;
    $949 = (($$748$i) + ($948)|0);
    $950 = (($941) - ($948))|0;
    HEAP32[(2624)>>2] = $949;
    HEAP32[(2612)>>2] = $950;
    $951 = $950 | 1;
    $952 = ((($949)) + 4|0);
    HEAP32[$952>>2] = $951;
    $953 = (($$748$i) + ($941)|0);
    $954 = ((($953)) + 4|0);
    HEAP32[$954>>2] = 40;
    $955 = HEAP32[(3088)>>2]|0;
    HEAP32[(2628)>>2] = $955;
    $956 = ((($938)) + 4|0);
    HEAP32[$956>>2] = 27;
    ;HEAP32[$939>>2]=HEAP32[(3048)>>2]|0;HEAP32[$939+4>>2]=HEAP32[(3048)+4>>2]|0;HEAP32[$939+8>>2]=HEAP32[(3048)+8>>2]|0;HEAP32[$939+12>>2]=HEAP32[(3048)+12>>2]|0;
    HEAP32[(3048)>>2] = $$748$i;
    HEAP32[(3052)>>2] = $$723947$i;
    HEAP32[(3060)>>2] = 0;
    HEAP32[(3056)>>2] = $939;
    $958 = $940;
    while(1) {
     $957 = ((($958)) + 4|0);
     HEAP32[$957>>2] = 7;
     $959 = ((($958)) + 8|0);
     $960 = ($959>>>0)<($923>>>0);
     if ($960) {
      $958 = $957;
     } else {
      break;
     }
    }
    $961 = ($938|0)==($636|0);
    if (!($961)) {
     $962 = $938;
     $963 = $636;
     $964 = (($962) - ($963))|0;
     $965 = HEAP32[$956>>2]|0;
     $966 = $965 & -2;
     HEAP32[$956>>2] = $966;
     $967 = $964 | 1;
     $968 = ((($636)) + 4|0);
     HEAP32[$968>>2] = $967;
     HEAP32[$938>>2] = $964;
     $969 = $964 >>> 3;
     $970 = ($964>>>0)<(256);
     if ($970) {
      $971 = $969 << 1;
      $972 = (2640 + ($971<<2)|0);
      $973 = HEAP32[650]|0;
      $974 = 1 << $969;
      $975 = $973 & $974;
      $976 = ($975|0)==(0);
      if ($976) {
       $977 = $973 | $974;
       HEAP32[650] = $977;
       $$pre$i$i = ((($972)) + 8|0);
       $$0211$i$i = $972;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $978 = ((($972)) + 8|0);
       $979 = HEAP32[$978>>2]|0;
       $980 = HEAP32[(2616)>>2]|0;
       $981 = ($980>>>0)>($979>>>0);
       if ($981) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $979;$$pre$phi$i$iZ2D = $978;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $636;
      $982 = ((($$0211$i$i)) + 12|0);
      HEAP32[$982>>2] = $636;
      $983 = ((($636)) + 8|0);
      HEAP32[$983>>2] = $$0211$i$i;
      $984 = ((($636)) + 12|0);
      HEAP32[$984>>2] = $972;
      break;
     }
     $985 = $964 >>> 8;
     $986 = ($985|0)==(0);
     if ($986) {
      $$0212$i$i = 0;
     } else {
      $987 = ($964>>>0)>(16777215);
      if ($987) {
       $$0212$i$i = 31;
      } else {
       $988 = (($985) + 1048320)|0;
       $989 = $988 >>> 16;
       $990 = $989 & 8;
       $991 = $985 << $990;
       $992 = (($991) + 520192)|0;
       $993 = $992 >>> 16;
       $994 = $993 & 4;
       $995 = $994 | $990;
       $996 = $991 << $994;
       $997 = (($996) + 245760)|0;
       $998 = $997 >>> 16;
       $999 = $998 & 2;
       $1000 = $995 | $999;
       $1001 = (14 - ($1000))|0;
       $1002 = $996 << $999;
       $1003 = $1002 >>> 15;
       $1004 = (($1001) + ($1003))|0;
       $1005 = $1004 << 1;
       $1006 = (($1004) + 7)|0;
       $1007 = $964 >>> $1006;
       $1008 = $1007 & 1;
       $1009 = $1008 | $1005;
       $$0212$i$i = $1009;
      }
     }
     $1010 = (2904 + ($$0212$i$i<<2)|0);
     $1011 = ((($636)) + 28|0);
     HEAP32[$1011>>2] = $$0212$i$i;
     $1012 = ((($636)) + 20|0);
     HEAP32[$1012>>2] = 0;
     HEAP32[$936>>2] = 0;
     $1013 = HEAP32[(2604)>>2]|0;
     $1014 = 1 << $$0212$i$i;
     $1015 = $1013 & $1014;
     $1016 = ($1015|0)==(0);
     if ($1016) {
      $1017 = $1013 | $1014;
      HEAP32[(2604)>>2] = $1017;
      HEAP32[$1010>>2] = $636;
      $1018 = ((($636)) + 24|0);
      HEAP32[$1018>>2] = $1010;
      $1019 = ((($636)) + 12|0);
      HEAP32[$1019>>2] = $636;
      $1020 = ((($636)) + 8|0);
      HEAP32[$1020>>2] = $636;
      break;
     }
     $1021 = HEAP32[$1010>>2]|0;
     $1022 = ($$0212$i$i|0)==(31);
     $1023 = $$0212$i$i >>> 1;
     $1024 = (25 - ($1023))|0;
     $1025 = $1022 ? 0 : $1024;
     $1026 = $964 << $1025;
     $$0206$i$i = $1026;$$0207$i$i = $1021;
     while(1) {
      $1027 = ((($$0207$i$i)) + 4|0);
      $1028 = HEAP32[$1027>>2]|0;
      $1029 = $1028 & -8;
      $1030 = ($1029|0)==($964|0);
      if ($1030) {
       label = 289;
       break;
      }
      $1031 = $$0206$i$i >>> 31;
      $1032 = (((($$0207$i$i)) + 16|0) + ($1031<<2)|0);
      $1033 = $$0206$i$i << 1;
      $1034 = HEAP32[$1032>>2]|0;
      $1035 = ($1034|0)==(0|0);
      if ($1035) {
       label = 286;
       break;
      } else {
       $$0206$i$i = $1033;$$0207$i$i = $1034;
      }
     }
     if ((label|0) == 286) {
      $1036 = HEAP32[(2616)>>2]|0;
      $1037 = ($1036>>>0)>($1032>>>0);
      if ($1037) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$1032>>2] = $636;
       $1038 = ((($636)) + 24|0);
       HEAP32[$1038>>2] = $$0207$i$i;
       $1039 = ((($636)) + 12|0);
       HEAP32[$1039>>2] = $636;
       $1040 = ((($636)) + 8|0);
       HEAP32[$1040>>2] = $636;
       break;
      }
     }
     else if ((label|0) == 289) {
      $1041 = ((($$0207$i$i)) + 8|0);
      $1042 = HEAP32[$1041>>2]|0;
      $1043 = HEAP32[(2616)>>2]|0;
      $1044 = ($1043>>>0)<=($$0207$i$i>>>0);
      $1045 = ($1043>>>0)<=($1042>>>0);
      $1046 = $1045 & $1044;
      if ($1046) {
       $1047 = ((($1042)) + 12|0);
       HEAP32[$1047>>2] = $636;
       HEAP32[$1041>>2] = $636;
       $1048 = ((($636)) + 8|0);
       HEAP32[$1048>>2] = $1042;
       $1049 = ((($636)) + 12|0);
       HEAP32[$1049>>2] = $$0207$i$i;
       $1050 = ((($636)) + 24|0);
       HEAP32[$1050>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1052 = HEAP32[(2612)>>2]|0;
  $1053 = ($1052>>>0)>($$0197>>>0);
  if ($1053) {
   $1054 = (($1052) - ($$0197))|0;
   HEAP32[(2612)>>2] = $1054;
   $1055 = HEAP32[(2624)>>2]|0;
   $1056 = (($1055) + ($$0197)|0);
   HEAP32[(2624)>>2] = $1056;
   $1057 = $1054 | 1;
   $1058 = ((($1056)) + 4|0);
   HEAP32[$1058>>2] = $1057;
   $1059 = $$0197 | 3;
   $1060 = ((($1055)) + 4|0);
   HEAP32[$1060>>2] = $1059;
   $1061 = ((($1055)) + 8|0);
   $$0 = $1061;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1062 = (___errno_location()|0);
 HEAP32[$1062>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0212$i = 0, $$0212$in$i = 0, $$0383 = 0, $$0384 = 0, $$0396 = 0, $$0403 = 0, $$1 = 0, $$1382 = 0, $$1387 = 0, $$1390 = 0, $$1398 = 0, $$1402 = 0, $$2 = 0, $$3 = 0, $$3400 = 0, $$pre = 0, $$pre$phi442Z2D = 0, $$pre$phi444Z2D = 0, $$pre$phiZ2D = 0, $$pre441 = 0;
 var $$pre443 = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0;
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0;
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0;
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0;
 var $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0;
 var $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0;
 var $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0;
 var $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0;
 var $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0;
 var $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond421 = 0, $cond422 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(2616)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 L10: do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(2620)>>2]|0;
   $20 = ($19|0)==($16|0);
   if ($20) {
    $105 = ((($10)) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = $106 & 3;
    $108 = ($107|0)==(3);
    if (!($108)) {
     $$1 = $16;$$1382 = $17;$113 = $16;
     break;
    }
    HEAP32[(2608)>>2] = $17;
    $109 = $106 & -2;
    HEAP32[$105>>2] = $109;
    $110 = $17 | 1;
    $111 = ((($16)) + 4|0);
    HEAP32[$111>>2] = $110;
    $112 = (($16) + ($17)|0);
    HEAP32[$112>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (2640 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($3>>>0)>($24>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[650]|0;
     $38 = $37 & $36;
     HEAP32[650] = $38;
     $$1 = $16;$$1382 = $17;$113 = $16;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre443 = ((($26)) + 8|0);
     $$pre$phi444Z2D = $$pre443;
    } else {
     $40 = ($3>>>0)>($26>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi444Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi444Z2D>>2] = $24;
    $$1 = $16;$$1382 = $17;$113 = $16;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1387 = $63;$$1390 = $59;
      }
     } else {
      $$1387 = $61;$$1390 = $60;
     }
     while(1) {
      $65 = ((($$1387)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if (!($67)) {
       $$1387 = $66;$$1390 = $65;
       continue;
      }
      $68 = ((($$1387)) + 16|0);
      $69 = HEAP32[$68>>2]|0;
      $70 = ($69|0)==(0|0);
      if ($70) {
       break;
      } else {
       $$1387 = $69;$$1390 = $68;
      }
     }
     $71 = ($3>>>0)>($$1390>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1390>>2] = 0;
      $$3 = $$1387;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($3>>>0)>($51>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1382 = $17;$113 = $16;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (2904 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($76|0)==($16|0);
    do {
     if ($77) {
      HEAP32[$75>>2] = $$3;
      $cond421 = ($$3|0)==(0|0);
      if ($cond421) {
       $78 = 1 << $74;
       $79 = $78 ^ -1;
       $80 = HEAP32[(2604)>>2]|0;
       $81 = $80 & $79;
       HEAP32[(2604)>>2] = $81;
       $$1 = $16;$$1382 = $17;$113 = $16;
       break L10;
      }
     } else {
      $82 = HEAP32[(2616)>>2]|0;
      $83 = ($82>>>0)>($46>>>0);
      if ($83) {
       _abort();
       // unreachable;
      } else {
       $84 = ((($46)) + 16|0);
       $85 = HEAP32[$84>>2]|0;
       $86 = ($85|0)!=($16|0);
       $$sink3 = $86&1;
       $87 = (((($46)) + 16|0) + ($$sink3<<2)|0);
       HEAP32[$87>>2] = $$3;
       $88 = ($$3|0)==(0|0);
       if ($88) {
        $$1 = $16;$$1382 = $17;$113 = $16;
        break L10;
       } else {
        break;
       }
      }
     }
    } while(0);
    $89 = HEAP32[(2616)>>2]|0;
    $90 = ($89>>>0)>($$3>>>0);
    if ($90) {
     _abort();
     // unreachable;
    }
    $91 = ((($$3)) + 24|0);
    HEAP32[$91>>2] = $46;
    $92 = ((($16)) + 16|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    do {
     if (!($94)) {
      $95 = ($89>>>0)>($93>>>0);
      if ($95) {
       _abort();
       // unreachable;
      } else {
       $96 = ((($$3)) + 16|0);
       HEAP32[$96>>2] = $93;
       $97 = ((($93)) + 24|0);
       HEAP32[$97>>2] = $$3;
       break;
      }
     }
    } while(0);
    $98 = ((($92)) + 4|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ($99|0)==(0|0);
    if ($100) {
     $$1 = $16;$$1382 = $17;$113 = $16;
    } else {
     $101 = HEAP32[(2616)>>2]|0;
     $102 = ($101>>>0)>($99>>>0);
     if ($102) {
      _abort();
      // unreachable;
     } else {
      $103 = ((($$3)) + 20|0);
      HEAP32[$103>>2] = $99;
      $104 = ((($99)) + 24|0);
      HEAP32[$104>>2] = $$3;
      $$1 = $16;$$1382 = $17;$113 = $16;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1382 = $9;$113 = $2;
  }
 } while(0);
 $114 = ($113>>>0)<($10>>>0);
 if (!($114)) {
  _abort();
  // unreachable;
 }
 $115 = ((($10)) + 4|0);
 $116 = HEAP32[$115>>2]|0;
 $117 = $116 & 1;
 $118 = ($117|0)==(0);
 if ($118) {
  _abort();
  // unreachable;
 }
 $119 = $116 & 2;
 $120 = ($119|0)==(0);
 if ($120) {
  $121 = HEAP32[(2624)>>2]|0;
  $122 = ($121|0)==($10|0);
  if ($122) {
   $123 = HEAP32[(2612)>>2]|0;
   $124 = (($123) + ($$1382))|0;
   HEAP32[(2612)>>2] = $124;
   HEAP32[(2624)>>2] = $$1;
   $125 = $124 | 1;
   $126 = ((($$1)) + 4|0);
   HEAP32[$126>>2] = $125;
   $127 = HEAP32[(2620)>>2]|0;
   $128 = ($$1|0)==($127|0);
   if (!($128)) {
    return;
   }
   HEAP32[(2620)>>2] = 0;
   HEAP32[(2608)>>2] = 0;
   return;
  }
  $129 = HEAP32[(2620)>>2]|0;
  $130 = ($129|0)==($10|0);
  if ($130) {
   $131 = HEAP32[(2608)>>2]|0;
   $132 = (($131) + ($$1382))|0;
   HEAP32[(2608)>>2] = $132;
   HEAP32[(2620)>>2] = $113;
   $133 = $132 | 1;
   $134 = ((($$1)) + 4|0);
   HEAP32[$134>>2] = $133;
   $135 = (($113) + ($132)|0);
   HEAP32[$135>>2] = $132;
   return;
  }
  $136 = $116 & -8;
  $137 = (($136) + ($$1382))|0;
  $138 = $116 >>> 3;
  $139 = ($116>>>0)<(256);
  L108: do {
   if ($139) {
    $140 = ((($10)) + 8|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = ((($10)) + 12|0);
    $143 = HEAP32[$142>>2]|0;
    $144 = $138 << 1;
    $145 = (2640 + ($144<<2)|0);
    $146 = ($141|0)==($145|0);
    if (!($146)) {
     $147 = HEAP32[(2616)>>2]|0;
     $148 = ($147>>>0)>($141>>>0);
     if ($148) {
      _abort();
      // unreachable;
     }
     $149 = ((($141)) + 12|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = ($150|0)==($10|0);
     if (!($151)) {
      _abort();
      // unreachable;
     }
    }
    $152 = ($143|0)==($141|0);
    if ($152) {
     $153 = 1 << $138;
     $154 = $153 ^ -1;
     $155 = HEAP32[650]|0;
     $156 = $155 & $154;
     HEAP32[650] = $156;
     break;
    }
    $157 = ($143|0)==($145|0);
    if ($157) {
     $$pre441 = ((($143)) + 8|0);
     $$pre$phi442Z2D = $$pre441;
    } else {
     $158 = HEAP32[(2616)>>2]|0;
     $159 = ($158>>>0)>($143>>>0);
     if ($159) {
      _abort();
      // unreachable;
     }
     $160 = ((($143)) + 8|0);
     $161 = HEAP32[$160>>2]|0;
     $162 = ($161|0)==($10|0);
     if ($162) {
      $$pre$phi442Z2D = $160;
     } else {
      _abort();
      // unreachable;
     }
    }
    $163 = ((($141)) + 12|0);
    HEAP32[$163>>2] = $143;
    HEAP32[$$pre$phi442Z2D>>2] = $141;
   } else {
    $164 = ((($10)) + 24|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ((($10)) + 12|0);
    $167 = HEAP32[$166>>2]|0;
    $168 = ($167|0)==($10|0);
    do {
     if ($168) {
      $179 = ((($10)) + 16|0);
      $180 = ((($179)) + 4|0);
      $181 = HEAP32[$180>>2]|0;
      $182 = ($181|0)==(0|0);
      if ($182) {
       $183 = HEAP32[$179>>2]|0;
       $184 = ($183|0)==(0|0);
       if ($184) {
        $$3400 = 0;
        break;
       } else {
        $$1398 = $183;$$1402 = $179;
       }
      } else {
       $$1398 = $181;$$1402 = $180;
      }
      while(1) {
       $185 = ((($$1398)) + 20|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($186|0)==(0|0);
       if (!($187)) {
        $$1398 = $186;$$1402 = $185;
        continue;
       }
       $188 = ((($$1398)) + 16|0);
       $189 = HEAP32[$188>>2]|0;
       $190 = ($189|0)==(0|0);
       if ($190) {
        break;
       } else {
        $$1398 = $189;$$1402 = $188;
       }
      }
      $191 = HEAP32[(2616)>>2]|0;
      $192 = ($191>>>0)>($$1402>>>0);
      if ($192) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1402>>2] = 0;
       $$3400 = $$1398;
       break;
      }
     } else {
      $169 = ((($10)) + 8|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = HEAP32[(2616)>>2]|0;
      $172 = ($171>>>0)>($170>>>0);
      if ($172) {
       _abort();
       // unreachable;
      }
      $173 = ((($170)) + 12|0);
      $174 = HEAP32[$173>>2]|0;
      $175 = ($174|0)==($10|0);
      if (!($175)) {
       _abort();
       // unreachable;
      }
      $176 = ((($167)) + 8|0);
      $177 = HEAP32[$176>>2]|0;
      $178 = ($177|0)==($10|0);
      if ($178) {
       HEAP32[$173>>2] = $167;
       HEAP32[$176>>2] = $170;
       $$3400 = $167;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $193 = ($165|0)==(0|0);
    if (!($193)) {
     $194 = ((($10)) + 28|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = (2904 + ($195<<2)|0);
     $197 = HEAP32[$196>>2]|0;
     $198 = ($197|0)==($10|0);
     do {
      if ($198) {
       HEAP32[$196>>2] = $$3400;
       $cond422 = ($$3400|0)==(0|0);
       if ($cond422) {
        $199 = 1 << $195;
        $200 = $199 ^ -1;
        $201 = HEAP32[(2604)>>2]|0;
        $202 = $201 & $200;
        HEAP32[(2604)>>2] = $202;
        break L108;
       }
      } else {
       $203 = HEAP32[(2616)>>2]|0;
       $204 = ($203>>>0)>($165>>>0);
       if ($204) {
        _abort();
        // unreachable;
       } else {
        $205 = ((($165)) + 16|0);
        $206 = HEAP32[$205>>2]|0;
        $207 = ($206|0)!=($10|0);
        $$sink5 = $207&1;
        $208 = (((($165)) + 16|0) + ($$sink5<<2)|0);
        HEAP32[$208>>2] = $$3400;
        $209 = ($$3400|0)==(0|0);
        if ($209) {
         break L108;
        } else {
         break;
        }
       }
      }
     } while(0);
     $210 = HEAP32[(2616)>>2]|0;
     $211 = ($210>>>0)>($$3400>>>0);
     if ($211) {
      _abort();
      // unreachable;
     }
     $212 = ((($$3400)) + 24|0);
     HEAP32[$212>>2] = $165;
     $213 = ((($10)) + 16|0);
     $214 = HEAP32[$213>>2]|0;
     $215 = ($214|0)==(0|0);
     do {
      if (!($215)) {
       $216 = ($210>>>0)>($214>>>0);
       if ($216) {
        _abort();
        // unreachable;
       } else {
        $217 = ((($$3400)) + 16|0);
        HEAP32[$217>>2] = $214;
        $218 = ((($214)) + 24|0);
        HEAP32[$218>>2] = $$3400;
        break;
       }
      }
     } while(0);
     $219 = ((($213)) + 4|0);
     $220 = HEAP32[$219>>2]|0;
     $221 = ($220|0)==(0|0);
     if (!($221)) {
      $222 = HEAP32[(2616)>>2]|0;
      $223 = ($222>>>0)>($220>>>0);
      if ($223) {
       _abort();
       // unreachable;
      } else {
       $224 = ((($$3400)) + 20|0);
       HEAP32[$224>>2] = $220;
       $225 = ((($220)) + 24|0);
       HEAP32[$225>>2] = $$3400;
       break;
      }
     }
    }
   }
  } while(0);
  $226 = $137 | 1;
  $227 = ((($$1)) + 4|0);
  HEAP32[$227>>2] = $226;
  $228 = (($113) + ($137)|0);
  HEAP32[$228>>2] = $137;
  $229 = HEAP32[(2620)>>2]|0;
  $230 = ($$1|0)==($229|0);
  if ($230) {
   HEAP32[(2608)>>2] = $137;
   return;
  } else {
   $$2 = $137;
  }
 } else {
  $231 = $116 & -2;
  HEAP32[$115>>2] = $231;
  $232 = $$1382 | 1;
  $233 = ((($$1)) + 4|0);
  HEAP32[$233>>2] = $232;
  $234 = (($113) + ($$1382)|0);
  HEAP32[$234>>2] = $$1382;
  $$2 = $$1382;
 }
 $235 = $$2 >>> 3;
 $236 = ($$2>>>0)<(256);
 if ($236) {
  $237 = $235 << 1;
  $238 = (2640 + ($237<<2)|0);
  $239 = HEAP32[650]|0;
  $240 = 1 << $235;
  $241 = $239 & $240;
  $242 = ($241|0)==(0);
  if ($242) {
   $243 = $239 | $240;
   HEAP32[650] = $243;
   $$pre = ((($238)) + 8|0);
   $$0403 = $238;$$pre$phiZ2D = $$pre;
  } else {
   $244 = ((($238)) + 8|0);
   $245 = HEAP32[$244>>2]|0;
   $246 = HEAP32[(2616)>>2]|0;
   $247 = ($246>>>0)>($245>>>0);
   if ($247) {
    _abort();
    // unreachable;
   } else {
    $$0403 = $245;$$pre$phiZ2D = $244;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $248 = ((($$0403)) + 12|0);
  HEAP32[$248>>2] = $$1;
  $249 = ((($$1)) + 8|0);
  HEAP32[$249>>2] = $$0403;
  $250 = ((($$1)) + 12|0);
  HEAP32[$250>>2] = $238;
  return;
 }
 $251 = $$2 >>> 8;
 $252 = ($251|0)==(0);
 if ($252) {
  $$0396 = 0;
 } else {
  $253 = ($$2>>>0)>(16777215);
  if ($253) {
   $$0396 = 31;
  } else {
   $254 = (($251) + 1048320)|0;
   $255 = $254 >>> 16;
   $256 = $255 & 8;
   $257 = $251 << $256;
   $258 = (($257) + 520192)|0;
   $259 = $258 >>> 16;
   $260 = $259 & 4;
   $261 = $260 | $256;
   $262 = $257 << $260;
   $263 = (($262) + 245760)|0;
   $264 = $263 >>> 16;
   $265 = $264 & 2;
   $266 = $261 | $265;
   $267 = (14 - ($266))|0;
   $268 = $262 << $265;
   $269 = $268 >>> 15;
   $270 = (($267) + ($269))|0;
   $271 = $270 << 1;
   $272 = (($270) + 7)|0;
   $273 = $$2 >>> $272;
   $274 = $273 & 1;
   $275 = $274 | $271;
   $$0396 = $275;
  }
 }
 $276 = (2904 + ($$0396<<2)|0);
 $277 = ((($$1)) + 28|0);
 HEAP32[$277>>2] = $$0396;
 $278 = ((($$1)) + 16|0);
 $279 = ((($$1)) + 20|0);
 HEAP32[$279>>2] = 0;
 HEAP32[$278>>2] = 0;
 $280 = HEAP32[(2604)>>2]|0;
 $281 = 1 << $$0396;
 $282 = $280 & $281;
 $283 = ($282|0)==(0);
 do {
  if ($283) {
   $284 = $280 | $281;
   HEAP32[(2604)>>2] = $284;
   HEAP32[$276>>2] = $$1;
   $285 = ((($$1)) + 24|0);
   HEAP32[$285>>2] = $276;
   $286 = ((($$1)) + 12|0);
   HEAP32[$286>>2] = $$1;
   $287 = ((($$1)) + 8|0);
   HEAP32[$287>>2] = $$1;
  } else {
   $288 = HEAP32[$276>>2]|0;
   $289 = ($$0396|0)==(31);
   $290 = $$0396 >>> 1;
   $291 = (25 - ($290))|0;
   $292 = $289 ? 0 : $291;
   $293 = $$2 << $292;
   $$0383 = $293;$$0384 = $288;
   while(1) {
    $294 = ((($$0384)) + 4|0);
    $295 = HEAP32[$294>>2]|0;
    $296 = $295 & -8;
    $297 = ($296|0)==($$2|0);
    if ($297) {
     label = 124;
     break;
    }
    $298 = $$0383 >>> 31;
    $299 = (((($$0384)) + 16|0) + ($298<<2)|0);
    $300 = $$0383 << 1;
    $301 = HEAP32[$299>>2]|0;
    $302 = ($301|0)==(0|0);
    if ($302) {
     label = 121;
     break;
    } else {
     $$0383 = $300;$$0384 = $301;
    }
   }
   if ((label|0) == 121) {
    $303 = HEAP32[(2616)>>2]|0;
    $304 = ($303>>>0)>($299>>>0);
    if ($304) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$299>>2] = $$1;
     $305 = ((($$1)) + 24|0);
     HEAP32[$305>>2] = $$0384;
     $306 = ((($$1)) + 12|0);
     HEAP32[$306>>2] = $$1;
     $307 = ((($$1)) + 8|0);
     HEAP32[$307>>2] = $$1;
     break;
    }
   }
   else if ((label|0) == 124) {
    $308 = ((($$0384)) + 8|0);
    $309 = HEAP32[$308>>2]|0;
    $310 = HEAP32[(2616)>>2]|0;
    $311 = ($310>>>0)<=($$0384>>>0);
    $312 = ($310>>>0)<=($309>>>0);
    $313 = $312 & $311;
    if ($313) {
     $314 = ((($309)) + 12|0);
     HEAP32[$314>>2] = $$1;
     HEAP32[$308>>2] = $$1;
     $315 = ((($$1)) + 8|0);
     HEAP32[$315>>2] = $309;
     $316 = ((($$1)) + 12|0);
     HEAP32[$316>>2] = $$0384;
     $317 = ((($$1)) + 24|0);
     HEAP32[$317>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $318 = HEAP32[(2632)>>2]|0;
 $319 = (($318) + -1)|0;
 HEAP32[(2632)>>2] = $319;
 $320 = ($319|0)==(0);
 if ($320) {
  $$0212$in$i = (3056);
 } else {
  return;
 }
 while(1) {
  $$0212$i = HEAP32[$$0212$in$i>>2]|0;
  $321 = ($$0212$i|0)==(0|0);
  $322 = ((($$0212$i)) + 8|0);
  if ($321) {
   break;
  } else {
   $$0212$in$i = $322;
  }
 }
 HEAP32[(2632)>>2] = -1;
 return;
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_737($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0;
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$26 = $17;
   while(1) {
    $27 = ($26|0)<(0);
    if ($27) {
     break;
    }
    $35 = (($$04855) - ($26))|0;
    $36 = ((($$04954)) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = ($26>>>0)>($37>>>0);
    $39 = ((($$04954)) + 8|0);
    $$150 = $38 ? $39 : $$04954;
    $40 = $38 << 31 >> 31;
    $$1 = (($$04756) + ($40))|0;
    $41 = $38 ? $37 : 0;
    $$0 = (($26) - ($41))|0;
    $42 = HEAP32[$$150>>2]|0;
    $43 = (($42) + ($$0)|0);
    HEAP32[$$150>>2] = $43;
    $44 = ((($$150)) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) - ($$0))|0;
    HEAP32[$44>>2] = $46;
    $47 = HEAP32[$13>>2]|0;
    $48 = $$150;
    HEAP32[$vararg_buffer3>>2] = $47;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $48;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $49 = (___syscall146(146,($vararg_buffer3|0))|0);
    $50 = (___syscall_ret($49)|0);
    $51 = ($35|0)==($50|0);
    if ($51) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $35;$$04954 = $$150;$26 = $50;
    }
   }
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $29 = HEAP32[$0>>2]|0;
   $30 = $29 | 32;
   HEAP32[$0>>2] = $30;
   $31 = ($$04756|0)==(2);
   if ($31) {
    $$051 = 0;
   } else {
    $32 = ((($$04954)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (($2) - ($33))|0;
    $$051 = $34;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$4>>2] = $25;
  HEAP32[$7>>2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3096|0);
}
function _dummy_737($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 32;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$015$lcssa = 0, $$01519 = 0, $$1$lcssa = 0, $$pn = 0, $$pre = 0, $$sink = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 4;
  } else {
   $$01519 = $0;$23 = $1;
   while(1) {
    $4 = HEAP8[$$01519>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$sink = $23;
     break L1;
    }
    $6 = ((($$01519)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 4;
     break;
    } else {
     $$01519 = $6;$23 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn = $$0;
   while(1) {
    $19 = ((($$pn)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$sink = $21;
 }
 $22 = (($$sink) - ($1))|0;
 return ($22|0);
}
function ___strdup($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_strlen($0)|0);
 $2 = (($1) + 1)|0;
 $3 = (_malloc($2)|0);
 $4 = ($3|0)==(0|0);
 if ($4) {
  $$0 = 0;
 } else {
  $5 = (_memcpy(($3|0),($0|0),($2|0))|0);
  $$0 = $5;
 }
 return ($$0|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((3100|0));
 return (3108|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((3100|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[148]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[148]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $25 = $17;
     } else {
      $25 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $26 = ($25|0)==(0);
     if (!($26)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 63]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 63]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function __Znwj($0) {
 $0 = $0|0;
 var $$ = 0, $$lcssa = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 $$ = $1 ? 1 : $0;
 while(1) {
  $2 = (_malloc($$)|0);
  $3 = ($2|0)==(0|0);
  if (!($3)) {
   $$lcssa = $2;
   break;
  }
  $4 = (__ZSt15get_new_handlerv()|0);
  $5 = ($4|0)==(0|0);
  if ($5) {
   $$lcssa = 0;
   break;
  }
  FUNCTION_TABLE_v[$4 & 0]();
 }
 return ($$lcssa|0);
}
function __ZdlPv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _free($0);
 return;
}
function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $3 = sp;
 $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 if ($4) {
  $$2 = 1;
 } else {
  $5 = ($1|0)==(0|0);
  if ($5) {
   $$2 = 0;
  } else {
   $6 = (___dynamic_cast($1,248,232,0)|0);
   $7 = ($6|0)==(0|0);
   if ($7) {
    $$2 = 0;
   } else {
    $8 = ((($3)) + 4|0);
    dest=$8; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
    HEAP32[$3>>2] = $6;
    $9 = ((($3)) + 8|0);
    HEAP32[$9>>2] = $0;
    $10 = ((($3)) + 12|0);
    HEAP32[$10>>2] = -1;
    $11 = ((($3)) + 48|0);
    HEAP32[$11>>2] = 1;
    $12 = HEAP32[$6>>2]|0;
    $13 = ((($12)) + 28|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = HEAP32[$2>>2]|0;
    FUNCTION_TABLE_viiii[$14 & 31]($6,$3,$15,1);
    $16 = ((($3)) + 24|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = ($17|0)==(1);
    if ($18) {
     $19 = ((($3)) + 16|0);
     $20 = HEAP32[$19>>2]|0;
     HEAP32[$2>>2] = $20;
     $$0 = 1;
    } else {
     $$0 = 0;
    }
    $$2 = $$0;
   }
  }
 }
 STACKTOP = sp;return ($$2|0);
}
function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if ($9) {
    $10 = ((($1)) + 16|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ($11|0)==($2|0);
    if (!($12)) {
     $13 = ((($1)) + 20|0);
     $14 = HEAP32[$13>>2]|0;
     $15 = ($14|0)==($2|0);
     if (!($15)) {
      $18 = ((($1)) + 32|0);
      HEAP32[$18>>2] = $3;
      HEAP32[$13>>2] = $2;
      $19 = ((($1)) + 40|0);
      $20 = HEAP32[$19>>2]|0;
      $21 = (($20) + 1)|0;
      HEAP32[$19>>2] = $21;
      $22 = ((($1)) + 36|0);
      $23 = HEAP32[$22>>2]|0;
      $24 = ($23|0)==(1);
      if ($24) {
       $25 = ((($1)) + 24|0);
       $26 = HEAP32[$25>>2]|0;
       $27 = ($26|0)==(2);
       if ($27) {
        $28 = ((($1)) + 54|0);
        HEAP8[$28>>0] = 1;
       }
      }
      $29 = ((($1)) + 44|0);
      HEAP32[$29>>2] = 4;
      break;
     }
    }
    $16 = ($3|0)==(1);
    if ($16) {
     $17 = ((($1)) + 32|0);
     HEAP32[$17>>2] = 1;
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 }
 return;
}
function __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==($1|0);
 return ($3|0);
}
function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 do {
  if ($6) {
   HEAP32[$4>>2] = $2;
   $7 = ((($1)) + 24|0);
   HEAP32[$7>>2] = $3;
   $8 = ((($1)) + 36|0);
   HEAP32[$8>>2] = 1;
  } else {
   $9 = ($5|0)==($2|0);
   if (!($9)) {
    $13 = ((($1)) + 36|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = (($14) + 1)|0;
    HEAP32[$13>>2] = $15;
    $16 = ((($1)) + 24|0);
    HEAP32[$16>>2] = 2;
    $17 = ((($1)) + 54|0);
    HEAP8[$17>>0] = 1;
    break;
   }
   $10 = ((($1)) + 24|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(2);
   if ($12) {
    HEAP32[$10>>2] = $3;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==($2|0);
 if ($6) {
  $7 = ((($1)) + 28|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ($8|0)==(1);
  if (!($9)) {
   HEAP32[$7>>2] = $3;
  }
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond22 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 53|0);
 HEAP8[$5>>0] = 1;
 $6 = ((($1)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==($3|0);
 do {
  if ($8) {
   $9 = ((($1)) + 52|0);
   HEAP8[$9>>0] = 1;
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(0|0);
   if ($12) {
    HEAP32[$10>>2] = $2;
    $13 = ((($1)) + 24|0);
    HEAP32[$13>>2] = $4;
    $14 = ((($1)) + 36|0);
    HEAP32[$14>>2] = 1;
    $15 = ((($1)) + 48|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ($16|0)==(1);
    $18 = ($4|0)==(1);
    $or$cond = $17 & $18;
    if (!($or$cond)) {
     break;
    }
    $19 = ((($1)) + 54|0);
    HEAP8[$19>>0] = 1;
    break;
   }
   $20 = ($11|0)==($2|0);
   if (!($20)) {
    $30 = ((($1)) + 36|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = (($31) + 1)|0;
    HEAP32[$30>>2] = $32;
    $33 = ((($1)) + 54|0);
    HEAP8[$33>>0] = 1;
    break;
   }
   $21 = ((($1)) + 24|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = ($22|0)==(2);
   if ($23) {
    HEAP32[$21>>2] = $4;
    $27 = $4;
   } else {
    $27 = $22;
   }
   $24 = ((($1)) + 48|0);
   $25 = HEAP32[$24>>2]|0;
   $26 = ($25|0)==(1);
   $28 = ($27|0)==(1);
   $or$cond22 = $26 & $28;
   if ($or$cond22) {
    $29 = ((($1)) + 54|0);
    HEAP8[$29>>0] = 1;
   }
  }
 } while(0);
 return;
}
function ___dynamic_cast($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$ = 0, $$0 = 0, $$33 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond28 = 0, $or$cond30 = 0, $or$cond32 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $4 = sp;
 $5 = HEAP32[$0>>2]|0;
 $6 = ((($5)) + -8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($0) + ($7)|0);
 $9 = ((($5)) + -4|0);
 $10 = HEAP32[$9>>2]|0;
 HEAP32[$4>>2] = $2;
 $11 = ((($4)) + 4|0);
 HEAP32[$11>>2] = $0;
 $12 = ((($4)) + 8|0);
 HEAP32[$12>>2] = $1;
 $13 = ((($4)) + 12|0);
 HEAP32[$13>>2] = $3;
 $14 = ((($4)) + 16|0);
 $15 = ((($4)) + 20|0);
 $16 = ((($4)) + 24|0);
 $17 = ((($4)) + 28|0);
 $18 = ((($4)) + 32|0);
 $19 = ((($4)) + 40|0);
 dest=$14; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));HEAP16[$14+36>>1]=0|0;HEAP8[$14+38>>0]=0|0;
 $20 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($10,$2,0)|0);
 L1: do {
  if ($20) {
   $21 = ((($4)) + 48|0);
   HEAP32[$21>>2] = 1;
   $22 = HEAP32[$10>>2]|0;
   $23 = ((($22)) + 20|0);
   $24 = HEAP32[$23>>2]|0;
   FUNCTION_TABLE_viiiiii[$24 & 31]($10,$4,$8,$8,1,0);
   $25 = HEAP32[$16>>2]|0;
   $26 = ($25|0)==(1);
   $$ = $26 ? $8 : 0;
   $$0 = $$;
  } else {
   $27 = ((($4)) + 36|0);
   $28 = HEAP32[$10>>2]|0;
   $29 = ((($28)) + 24|0);
   $30 = HEAP32[$29>>2]|0;
   FUNCTION_TABLE_viiiii[$30 & 31]($10,$4,$8,1,0);
   $31 = HEAP32[$27>>2]|0;
   switch ($31|0) {
   case 0:  {
    $32 = HEAP32[$19>>2]|0;
    $33 = ($32|0)==(1);
    $34 = HEAP32[$17>>2]|0;
    $35 = ($34|0)==(1);
    $or$cond = $33 & $35;
    $36 = HEAP32[$18>>2]|0;
    $37 = ($36|0)==(1);
    $or$cond28 = $or$cond & $37;
    $38 = HEAP32[$15>>2]|0;
    $$33 = $or$cond28 ? $38 : 0;
    $$0 = $$33;
    break L1;
    break;
   }
   case 1:  {
    break;
   }
   default: {
    $$0 = 0;
    break L1;
   }
   }
   $39 = HEAP32[$16>>2]|0;
   $40 = ($39|0)==(1);
   if (!($40)) {
    $41 = HEAP32[$19>>2]|0;
    $42 = ($41|0)==(0);
    $43 = HEAP32[$17>>2]|0;
    $44 = ($43|0)==(1);
    $or$cond30 = $42 & $44;
    $45 = HEAP32[$18>>2]|0;
    $46 = ($45|0)==(1);
    $or$cond32 = $or$cond30 & $46;
    if (!($or$cond32)) {
     $$0 = 0;
     break;
    }
   }
   $47 = HEAP32[$14>>2]|0;
   $$0 = $47;
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($0)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($11)) + 20|0);
  $13 = HEAP32[$12>>2]|0;
  FUNCTION_TABLE_viiiiii[$13 & 31]($10,$1,$2,$3,$4,$5);
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$037$off038 = 0, $$037$off039 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if (!($9)) {
    $43 = ((($0)) + 8|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = HEAP32[$44>>2]|0;
    $46 = ((($45)) + 24|0);
    $47 = HEAP32[$46>>2]|0;
    FUNCTION_TABLE_viiiii[$47 & 31]($44,$1,$2,$3,$4);
    break;
   }
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==($2|0);
   if (!($12)) {
    $13 = ((($1)) + 20|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($14|0)==($2|0);
    if (!($15)) {
     $18 = ((($1)) + 32|0);
     HEAP32[$18>>2] = $3;
     $19 = ((($1)) + 44|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($20|0)==(4);
     if ($21) {
      break;
     }
     $22 = ((($1)) + 52|0);
     HEAP8[$22>>0] = 0;
     $23 = ((($1)) + 53|0);
     HEAP8[$23>>0] = 0;
     $24 = ((($0)) + 8|0);
     $25 = HEAP32[$24>>2]|0;
     $26 = HEAP32[$25>>2]|0;
     $27 = ((($26)) + 20|0);
     $28 = HEAP32[$27>>2]|0;
     FUNCTION_TABLE_viiiiii[$28 & 31]($25,$1,$2,$2,1,$4);
     $29 = HEAP8[$23>>0]|0;
     $30 = ($29<<24>>24)==(0);
     if ($30) {
      $$037$off038 = 4;
      label = 11;
     } else {
      $31 = HEAP8[$22>>0]|0;
      $32 = ($31<<24>>24)==(0);
      if ($32) {
       $$037$off038 = 3;
       label = 11;
      } else {
       $$037$off039 = 3;
      }
     }
     if ((label|0) == 11) {
      HEAP32[$13>>2] = $2;
      $33 = ((($1)) + 40|0);
      $34 = HEAP32[$33>>2]|0;
      $35 = (($34) + 1)|0;
      HEAP32[$33>>2] = $35;
      $36 = ((($1)) + 36|0);
      $37 = HEAP32[$36>>2]|0;
      $38 = ($37|0)==(1);
      if ($38) {
       $39 = ((($1)) + 24|0);
       $40 = HEAP32[$39>>2]|0;
       $41 = ($40|0)==(2);
       if ($41) {
        $42 = ((($1)) + 54|0);
        HEAP8[$42>>0] = 1;
        $$037$off039 = $$037$off038;
       } else {
        $$037$off039 = $$037$off038;
       }
      } else {
       $$037$off039 = $$037$off038;
      }
     }
     HEAP32[$19>>2] = $$037$off039;
     break;
    }
   }
   $16 = ($3|0)==(1);
   if ($16) {
    $17 = ((($1)) + 32|0);
    HEAP32[$17>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 } else {
  $7 = ((($0)) + 8|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = HEAP32[$8>>2]|0;
  $10 = ((($9)) + 28|0);
  $11 = HEAP32[$10>>2]|0;
  FUNCTION_TABLE_viiii[$11 & 31]($8,$1,$2,$3);
 }
 return;
}
function __ZNSt9type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv123__fundamental_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 return ($3|0);
}
function __ZN10__cxxabiv119__pointer_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $3 = sp;
 $4 = HEAP32[$2>>2]|0;
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$2>>2] = $5;
 $6 = (__ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,0)|0);
 if ($6) {
  $$4 = 1;
 } else {
  $7 = ($1|0)==(0|0);
  if ($7) {
   $$4 = 0;
  } else {
   $8 = (___dynamic_cast($1,248,304,0)|0);
   $9 = ($8|0)==(0|0);
   if ($9) {
    $$4 = 0;
   } else {
    $10 = ((($8)) + 8|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ((($0)) + 8|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = $13 ^ -1;
    $15 = $11 & $14;
    $16 = ($15|0)==(0);
    if ($16) {
     $17 = ((($0)) + 12|0);
     $18 = HEAP32[$17>>2]|0;
     $19 = ((($8)) + 12|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($18,$20,0)|0);
     if ($21) {
      $$4 = 1;
     } else {
      $22 = HEAP32[$17>>2]|0;
      $23 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($22,336,0)|0);
      if ($23) {
       $$4 = 1;
      } else {
       $24 = HEAP32[$17>>2]|0;
       $25 = ($24|0)==(0|0);
       if ($25) {
        $$4 = 0;
       } else {
        $26 = (___dynamic_cast($24,248,232,0)|0);
        $27 = ($26|0)==(0|0);
        if ($27) {
         $$4 = 0;
        } else {
         $28 = HEAP32[$19>>2]|0;
         $29 = ($28|0)==(0|0);
         if ($29) {
          $$4 = 0;
         } else {
          $30 = (___dynamic_cast($28,248,232,0)|0);
          $31 = ($30|0)==(0|0);
          if ($31) {
           $$4 = 0;
          } else {
           $32 = ((($3)) + 4|0);
           dest=$32; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
           HEAP32[$3>>2] = $30;
           $33 = ((($3)) + 8|0);
           HEAP32[$33>>2] = $26;
           $34 = ((($3)) + 12|0);
           HEAP32[$34>>2] = -1;
           $35 = ((($3)) + 48|0);
           HEAP32[$35>>2] = 1;
           $36 = HEAP32[$30>>2]|0;
           $37 = ((($36)) + 28|0);
           $38 = HEAP32[$37>>2]|0;
           $39 = HEAP32[$2>>2]|0;
           FUNCTION_TABLE_viiii[$38 & 31]($30,$3,$39,1);
           $40 = ((($3)) + 24|0);
           $41 = HEAP32[$40>>2]|0;
           $42 = ($41|0)==(1);
           if ($42) {
            $43 = ((($3)) + 16|0);
            $44 = HEAP32[$43>>2]|0;
            HEAP32[$2>>2] = $44;
            $$0 = 1;
           } else {
            $$0 = 0;
           }
           $$4 = $$0;
          }
         }
        }
       }
      }
     }
    } else {
     $$4 = 0;
    }
   }
  }
 }
 STACKTOP = sp;return ($$4|0);
}
function __ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 if ($3) {
  $$0 = 1;
 } else {
  $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($1,344,0)|0);
  $$0 = $4;
 }
 return ($$0|0);
}
function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($1)) + 52|0);
  $10 = HEAP8[$9>>0]|0;
  $11 = ((($1)) + 53|0);
  $12 = HEAP8[$11>>0]|0;
  $13 = ((($0)) + 16|0);
  $14 = ((($0)) + 12|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = (((($0)) + 16|0) + ($15<<3)|0);
  HEAP8[$9>>0] = 0;
  HEAP8[$11>>0] = 0;
  __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($13,$1,$2,$3,$4,$5);
  $17 = ($15|0)>(1);
  L4: do {
   if ($17) {
    $18 = ((($0)) + 24|0);
    $19 = ((($1)) + 24|0);
    $20 = ((($0)) + 8|0);
    $21 = ((($1)) + 54|0);
    $$0 = $18;
    while(1) {
     $22 = HEAP8[$21>>0]|0;
     $23 = ($22<<24>>24)==(0);
     if (!($23)) {
      break L4;
     }
     $24 = HEAP8[$9>>0]|0;
     $25 = ($24<<24>>24)==(0);
     if ($25) {
      $31 = HEAP8[$11>>0]|0;
      $32 = ($31<<24>>24)==(0);
      if (!($32)) {
       $33 = HEAP32[$20>>2]|0;
       $34 = $33 & 1;
       $35 = ($34|0)==(0);
       if ($35) {
        break L4;
       }
      }
     } else {
      $26 = HEAP32[$19>>2]|0;
      $27 = ($26|0)==(1);
      if ($27) {
       break L4;
      }
      $28 = HEAP32[$20>>2]|0;
      $29 = $28 & 2;
      $30 = ($29|0)==(0);
      if ($30) {
       break L4;
      }
     }
     HEAP8[$9>>0] = 0;
     HEAP8[$11>>0] = 0;
     __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$0,$1,$2,$3,$4,$5);
     $36 = ((($$0)) + 8|0);
     $37 = ($36>>>0)<($16>>>0);
     if ($37) {
      $$0 = $36;
     } else {
      break;
     }
    }
   }
  } while(0);
  HEAP8[$9>>0] = $10;
  HEAP8[$11>>0] = $12;
 }
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $$081$off0 = 0, $$084 = 0, $$085$off0 = 0, $$1 = 0, $$182$off0 = 0, $$186$off0 = 0, $$2 = 0, $$283$off0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 L1: do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if (!($9)) {
    $56 = ((($0)) + 16|0);
    $57 = ((($0)) + 12|0);
    $58 = HEAP32[$57>>2]|0;
    $59 = (((($0)) + 16|0) + ($58<<3)|0);
    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($56,$1,$2,$3,$4);
    $60 = ((($0)) + 24|0);
    $61 = ($58|0)>(1);
    if (!($61)) {
     break;
    }
    $62 = ((($0)) + 8|0);
    $63 = HEAP32[$62>>2]|0;
    $64 = $63 & 2;
    $65 = ($64|0)==(0);
    if ($65) {
     $66 = ((($1)) + 36|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ($67|0)==(1);
     if (!($68)) {
      $74 = $63 & 1;
      $75 = ($74|0)==(0);
      if ($75) {
       $78 = ((($1)) + 54|0);
       $$2 = $60;
       while(1) {
        $87 = HEAP8[$78>>0]|0;
        $88 = ($87<<24>>24)==(0);
        if (!($88)) {
         break L1;
        }
        $89 = HEAP32[$66>>2]|0;
        $90 = ($89|0)==(1);
        if ($90) {
         break L1;
        }
        __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$2,$1,$2,$3,$4);
        $91 = ((($$2)) + 8|0);
        $92 = ($91>>>0)<($59>>>0);
        if ($92) {
         $$2 = $91;
        } else {
         break L1;
        }
       }
      }
      $76 = ((($1)) + 24|0);
      $77 = ((($1)) + 54|0);
      $$1 = $60;
      while(1) {
       $79 = HEAP8[$77>>0]|0;
       $80 = ($79<<24>>24)==(0);
       if (!($80)) {
        break L1;
       }
       $81 = HEAP32[$66>>2]|0;
       $82 = ($81|0)==(1);
       if ($82) {
        $83 = HEAP32[$76>>2]|0;
        $84 = ($83|0)==(1);
        if ($84) {
         break L1;
        }
       }
       __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$1,$1,$2,$3,$4);
       $85 = ((($$1)) + 8|0);
       $86 = ($85>>>0)<($59>>>0);
       if ($86) {
        $$1 = $85;
       } else {
        break L1;
       }
      }
     }
    }
    $69 = ((($1)) + 54|0);
    $$0 = $60;
    while(1) {
     $70 = HEAP8[$69>>0]|0;
     $71 = ($70<<24>>24)==(0);
     if (!($71)) {
      break L1;
     }
     __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$0,$1,$2,$3,$4);
     $72 = ((($$0)) + 8|0);
     $73 = ($72>>>0)<($59>>>0);
     if ($73) {
      $$0 = $72;
     } else {
      break L1;
     }
    }
   }
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==($2|0);
   if (!($12)) {
    $13 = ((($1)) + 20|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($14|0)==($2|0);
    if (!($15)) {
     $18 = ((($1)) + 32|0);
     HEAP32[$18>>2] = $3;
     $19 = ((($1)) + 44|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($20|0)==(4);
     if ($21) {
      break;
     }
     $22 = ((($0)) + 16|0);
     $23 = ((($0)) + 12|0);
     $24 = HEAP32[$23>>2]|0;
     $25 = (((($0)) + 16|0) + ($24<<3)|0);
     $26 = ((($1)) + 52|0);
     $27 = ((($1)) + 53|0);
     $28 = ((($1)) + 54|0);
     $29 = ((($0)) + 8|0);
     $30 = ((($1)) + 24|0);
     $$081$off0 = 0;$$084 = $22;$$085$off0 = 0;
     L32: while(1) {
      $31 = ($$084>>>0)<($25>>>0);
      if (!($31)) {
       $$283$off0 = $$081$off0;
       label = 18;
       break;
      }
      HEAP8[$26>>0] = 0;
      HEAP8[$27>>0] = 0;
      __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$084,$1,$2,$2,1,$4);
      $32 = HEAP8[$28>>0]|0;
      $33 = ($32<<24>>24)==(0);
      if (!($33)) {
       $$283$off0 = $$081$off0;
       label = 18;
       break;
      }
      $34 = HEAP8[$27>>0]|0;
      $35 = ($34<<24>>24)==(0);
      do {
       if ($35) {
        $$182$off0 = $$081$off0;$$186$off0 = $$085$off0;
       } else {
        $36 = HEAP8[$26>>0]|0;
        $37 = ($36<<24>>24)==(0);
        if ($37) {
         $43 = HEAP32[$29>>2]|0;
         $44 = $43 & 1;
         $45 = ($44|0)==(0);
         if ($45) {
          $$283$off0 = 1;
          label = 18;
          break L32;
         } else {
          $$182$off0 = 1;$$186$off0 = $$085$off0;
          break;
         }
        }
        $38 = HEAP32[$30>>2]|0;
        $39 = ($38|0)==(1);
        if ($39) {
         label = 23;
         break L32;
        }
        $40 = HEAP32[$29>>2]|0;
        $41 = $40 & 2;
        $42 = ($41|0)==(0);
        if ($42) {
         label = 23;
         break L32;
        } else {
         $$182$off0 = 1;$$186$off0 = 1;
        }
       }
      } while(0);
      $46 = ((($$084)) + 8|0);
      $$081$off0 = $$182$off0;$$084 = $46;$$085$off0 = $$186$off0;
     }
     do {
      if ((label|0) == 18) {
       if (!($$085$off0)) {
        HEAP32[$13>>2] = $2;
        $47 = ((($1)) + 40|0);
        $48 = HEAP32[$47>>2]|0;
        $49 = (($48) + 1)|0;
        HEAP32[$47>>2] = $49;
        $50 = ((($1)) + 36|0);
        $51 = HEAP32[$50>>2]|0;
        $52 = ($51|0)==(1);
        if ($52) {
         $53 = HEAP32[$30>>2]|0;
         $54 = ($53|0)==(2);
         if ($54) {
          HEAP8[$28>>0] = 1;
          if ($$283$off0) {
           label = 23;
           break;
          } else {
           $55 = 4;
           break;
          }
         }
        }
       }
       if ($$283$off0) {
        label = 23;
       } else {
        $55 = 4;
       }
      }
     } while(0);
     if ((label|0) == 23) {
      $55 = 3;
     }
     HEAP32[$19>>2] = $55;
     break;
    }
   }
   $16 = ($3|0)==(1);
   if ($16) {
    $17 = ((($1)) + 32|0);
    HEAP32[$17>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 L1: do {
  if ($6) {
   __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
  } else {
   $7 = ((($0)) + 16|0);
   $8 = ((($0)) + 12|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = (((($0)) + 16|0) + ($9<<3)|0);
   __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($7,$1,$2,$3);
   $11 = ($9|0)>(1);
   if ($11) {
    $12 = ((($0)) + 24|0);
    $13 = ((($1)) + 54|0);
    $$0 = $12;
    while(1) {
     __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($$0,$1,$2,$3);
     $14 = HEAP8[$13>>0]|0;
     $15 = ($14<<24>>24)==(0);
     if (!($15)) {
      break L1;
     }
     $16 = ((($$0)) + 8|0);
     $17 = ($16>>>0)<($10>>>0);
     if ($17) {
      $$0 = $16;
     } else {
      break;
     }
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 >> 8;
 $7 = $5 & 1;
 $8 = ($7|0)==(0);
 if ($8) {
  $$0 = $6;
 } else {
  $9 = HEAP32[$2>>2]|0;
  $10 = (($9) + ($6)|0);
  $11 = HEAP32[$10>>2]|0;
  $$0 = $11;
 }
 $12 = HEAP32[$0>>2]|0;
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($13)) + 28|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($2) + ($$0)|0);
 $17 = $5 & 2;
 $18 = ($17|0)!=(0);
 $19 = $18 ? $3 : 2;
 FUNCTION_TABLE_viiii[$15 & 31]($12,$1,$16,$19);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($0)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $7 >> 8;
 $9 = $7 & 1;
 $10 = ($9|0)==(0);
 if ($10) {
  $$0 = $8;
 } else {
  $11 = HEAP32[$3>>2]|0;
  $12 = (($11) + ($8)|0);
  $13 = HEAP32[$12>>2]|0;
  $$0 = $13;
 }
 $14 = HEAP32[$0>>2]|0;
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($15)) + 20|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($3) + ($$0)|0);
 $19 = $7 & 2;
 $20 = ($19|0)!=(0);
 $21 = $20 ? $4 : 2;
 FUNCTION_TABLE_viiiiii[$17 & 31]($14,$1,$2,$18,$21,$5);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($0)) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 >> 8;
 $8 = $6 & 1;
 $9 = ($8|0)==(0);
 if ($9) {
  $$0 = $7;
 } else {
  $10 = HEAP32[$2>>2]|0;
  $11 = (($10) + ($7)|0);
  $12 = HEAP32[$11>>2]|0;
  $$0 = $12;
 }
 $13 = HEAP32[$0>>2]|0;
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($14)) + 24|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = (($2) + ($$0)|0);
 $18 = $6 & 2;
 $19 = ($18|0)!=(0);
 $20 = $19 ? $3 : 2;
 FUNCTION_TABLE_viiiii[$16 & 31]($13,$1,$17,$20,$4);
 return;
}
function __ZSt15get_new_handlerv() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[778]|0;
 $1 = (($0) + 0)|0;
 HEAP32[778] = $1;
 $2 = $0;
 return ($2|0);
}
function runPostSets() {
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}

  
function dynCall_dii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return +FUNCTION_TABLE_dii[index&31](a1|0,a2|0);
}


function dynCall_i(index) {
  index = index|0;
  
  return FUNCTION_TABLE_i[index&31]()|0;
}


function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&31](a1|0)|0;
}


function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&31](a1|0,a2|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&63](a1|0,a2|0,a3|0)|0;
}


function dynCall_v(index) {
  index = index|0;
  
  FUNCTION_TABLE_v[index&0]();
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&31](a1|0);
}


function dynCall_viid(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=+a3;
  FUNCTION_TABLE_viid[index&31](a1|0,a2|0,+a3);
}


function dynCall_viii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  FUNCTION_TABLE_viii[index&31](a1|0,a2|0,a3|0);
}


function dynCall_viiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  FUNCTION_TABLE_viiii[index&31](a1|0,a2|0,a3|0,a4|0);
}


function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  FUNCTION_TABLE_viiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0);
}


function dynCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  FUNCTION_TABLE_viiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0);
}

function b0(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_dii(0);return +0;
}
function b1() {
 ; nullFunc_i(1);return 0;
}
function b2(p0) {
 p0 = p0|0; nullFunc_ii(2);return 0;
}
function b3(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(3);return 0;
}
function b4(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(4);return 0;
}
function b5() {
 ; nullFunc_v(5);
}
function b6(p0) {
 p0 = p0|0; nullFunc_vi(6);
}
function b7(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = +p2; nullFunc_viid(7);
}
function b8(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_viii(8);
}
function b9(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_viiii(9);
}
function b10(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_viiiii(10);
}
function b11(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_viiiiii(11);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_dii = [b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,__ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassfE7getWireIS2_EEfRKMS2_fRKT_
,b0,b0,b0];
var FUNCTION_TABLE_i = [b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZN10emscripten8internal12operator_newI15fc32_IirLowPassJEEEPT_DpOT0_,b1,b1
,b1,b1,b1];
var FUNCTION_TABLE_ii = [b2,___stdio_close,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,__ZN10emscripten8internal13getActualTypeI15fc32_IirLowPassEEPKvPT_,b2,b2,__ZN10emscripten8internal7InvokerIP15fc32_IirLowPassJEE6invokeEPFS3_vE,b2
,b2,b2,b2];
var FUNCTION_TABLE_iii = [b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,__ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassiE7getWireIS2_EEiRKMS2_iRKT_,b3];
var FUNCTION_TABLE_iiii = [b4,b4,___stdout_write,___stdio_seek,b4,b4,b4,b4,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,b4,b4,b4,b4,b4,b4,b4,b4,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,b4,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,___stdio_write,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4];
var FUNCTION_TABLE_v = [b5];
var FUNCTION_TABLE_vi = [b6,b6,b6,b6,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,b6,b6,b6,b6,__ZN10__cxxabiv120__si_class_type_infoD0Ev,b6,b6,b6,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,b6,__ZN10__cxxabiv119__pointer_type_infoD0Ev,b6,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,b6,b6,b6,b6,__ZN10emscripten8internal14raw_destructorI15fc32_IirLowPassEEvPT_,b6,b6,b6
,b6,b6,b6];
var FUNCTION_TABLE_viid = [b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,__ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassfE7setWireIS2_EEvRKMS2_fRT_f,b7,b7];
var FUNCTION_TABLE_viii = [b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,__ZN10emscripten8internal12MemberAccessI15fc32_IirLowPassiE7setWireIS2_EEvRKMS2_iRT_i];
var FUNCTION_TABLE_viiii = [b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b9,b9,b9,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b9,b9,b9,b9,b9,b9,b9,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b9,b9,b9,b9,b9
,b9,b9,b9];
var FUNCTION_TABLE_viiiii = [b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b10,b10,b10,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b10,b10,b10,b10,b10,b10,b10,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b10,b10,b10,b10,b10,b10
,b10,b10,b10];
var FUNCTION_TABLE_viiiiii = [b11,b11,b11,b11,b11,b11,b11,b11,b11,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b11,b11,b11,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b11,b11,b11,b11,b11,b11,b11,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b11,b11,b11,b11,b11,b11,b11
,b11,b11,b11];

  return { __GLOBAL__sub_I_bind_cpp: __GLOBAL__sub_I_bind_cpp, __GLOBAL__sub_I_fc_lib_wrapper_cpp: __GLOBAL__sub_I_fc_lib_wrapper_cpp, ___errno_location: ___errno_location, ___getTypeName: ___getTypeName, _fflush: _fflush, _free: _free, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_dii: dynCall_dii, dynCall_i: dynCall_i, dynCall_ii: dynCall_ii, dynCall_iii: dynCall_iii, dynCall_iiii: dynCall_iiii, dynCall_v: dynCall_v, dynCall_vi: dynCall_vi, dynCall_viid: dynCall_viid, dynCall_viii: dynCall_viii, dynCall_viiii: dynCall_viiii, dynCall_viiiii: dynCall_viiiii, dynCall_viiiiii: dynCall_viiiiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real___GLOBAL__sub_I_bind_cpp = asm["__GLOBAL__sub_I_bind_cpp"]; asm["__GLOBAL__sub_I_bind_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_bind_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_fc_lib_wrapper_cpp = asm["__GLOBAL__sub_I_fc_lib_wrapper_cpp"]; asm["__GLOBAL__sub_I_fc_lib_wrapper_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_fc_lib_wrapper_cpp.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____getTypeName = asm["___getTypeName"]; asm["___getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____getTypeName.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
var __GLOBAL__sub_I_fc_lib_wrapper_cpp = Module["__GLOBAL__sub_I_fc_lib_wrapper_cpp"] = asm["__GLOBAL__sub_I_fc_lib_wrapper_cpp"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    if (typeof Module['locateFile'] === 'function') {
      memoryInitializer = Module['locateFile'](memoryInitializer);
    } else if (Module['memoryInitializerPrefixURL']) {
      memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
    }
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
            // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
            // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = Module['print'];
  var printErr = Module['printErr'];
  var has = false;
  Module['print'] = Module['printErr'] = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  Module['print'] = print;
  Module['printErr'] = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      Module.printErr('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



//# sourceMappingURL=fc_lib.js.map