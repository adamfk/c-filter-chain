c-filter-chain

## TODO
* Add `override` keyword to more methods that override base methods
* rename to BuildContext/RunContext
* Visitor Enter/exit
* error marking for bad setups
* testing bad setups
* prevent direct use of malloc/free in Block lib implementations
  * Needs to be through allocator
* use smart pointers. leaking memory in test code when creating IMetaNewx objects


## Dummy Variables - OUTDATED!
The c++ test code often uses dummy variables to make a unique function/method signature for a type T so that
c++ method/function overloading will pick the right one.

```c++
static fc8_PassThrough* CppPassThrough_new(fc8_PassThrough const * dummy, fc_Builder* builder) {
  return fc8_PassThrough_new(bc);
}

static fc32_PassThrough* CppPassThrough_new(fc32_PassThrough const * dummy, fc_Builder* builder) {
  return fc32_PassThrough_new(bc);
}  
```

This allows us to use c++ generic testing functions like below:

```c++
template <typename T> class PassThroughTester : public BasicTester<T>
{
  //build a PassThrough object using the correct `_new()` function
  //based on the type T being tested right now.
  virtual T* build_new_block(DummyT dummy, fc_Builder* mb) {
    return CppPassThrough_new(dummy, mb);
  }
  ...
}
```

### DummyT shorthand
Dummy variables are used so much that a typedef is often used like:

```c++
template <typename T> class BasicTester {
public:
  typedef T const * DummyT;
  ...
}
```

The dummy variables are `const` to help ensure that they aren't confused for real IBlock variables/arguments. 
This is useful because many functions don't need a dummy variable as their signature is already unique to
type T:

```c++
  static int32_t CppX_step(fc32_Median* block, int32_t input) {
    return fc32_Median_step(block, input);
  }
```

### template meta programming over dummy vars
The dummy variables could be removed with template meta programming, but this may end up raising the complexity
too high for the target audience of embedded `c` programmers. This library is already complex enough as it is.

One of the main problem spots is trying to implement
`T* CppPassThrough_new(fc_Builder* builder)` functions as this requires return type specialization. 

A solution is given in this stack overflow question:
https://stackoverflow.com/questions/15911890/overriding-return-type-in-function-template-specialization

If it was possible to hide all the meta template programming away from filter Block authors, then I would be
interested. I want to make it as easy as possible for people to create new Blocks for the lib.





### resources
* worth looking at https://groups.google.com/forum/#!topic/googletestframework/3d8H5J5Isnw regarding getting type
* good tips: https://stackoverflow.com/questions/19660715/switching-off-insequence

