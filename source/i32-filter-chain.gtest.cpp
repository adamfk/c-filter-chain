
#include "i32-filter-chain.h"

#include "gmock/gmock.h"
#include "gtest/gtest.h"
#include <stdio.h>

//TODO create general macros file

/**
* Macro for getting the size of an array that is known at compile time. Code from Google's Chromium project.
* Taken from http://stackoverflow.com/questions/4415524/common-array-length-macro-for-c
*
* Helps guard against taking the size of a pointer to an array and some other C++ stuff;
*/
#define COUNT_OF(x) ((sizeof(x)/sizeof(0[x])) / ((size_t)(!(sizeof(x) % sizeof(0[x])))))




TEST(FilterChain_i32, OnePassthrough) {

  fcb32_PassThrough p;
  fcb32_PassThrough_new(&p);

  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* filter_blocks[] = {
    &p.block,
  };
  filter_chain.blocks = &filter_blocks[0];
  filter_chain.block_count = COUNT_OF(filter_blocks);
  fc32_FilterChain_setup(&filter_chain);

  for (size_t i = 0; i < 50; i++)
  {
    int32_t input = i;
    int32_t output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_EQ(output, input);
  }
}


TEST(FilterChain_i32, TwoPassthrough) {

  fcb32_PassThrough p1;
  fcb32_PassThrough_new(&p1);

  fcb32_PassThrough p2;
  fcb32_PassThrough_new(&p2);


  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &p1.block,
    &p2.block,
  };
  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);


  for (size_t i = 0; i < 50; i++)
  {
    int32_t input = i;
    int32_t output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_EQ(output, input);
  }
}


TEST(FilterChain_i32, OneIirPrecalc) {

  fcb32_IirLowPass1 iir1;
  fcb32_IirLowPass1_new(&iir1);
  iir1.new_ratio = 0.2f;


  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &iir1.block,
  };
  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);

  const int32_t input = 100;
  const int32_t error_tol = 1;
  int32_t expected;
  int32_t output = 0;

  int32_t expected_outputs[] = {
    20,
    36,
    49,
    59,
    67,
    74,
    79,
    83,
    87,
    89,
    91,
    93,
    95,
    96,
    96,
    97,
    98,
    98,
    99,
  };

  for (size_t i = 0; i < COUNT_OF(expected_outputs); i++)
  {
    expected = expected_outputs[i];
    output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_NEAR(expected, output, error_tol);
  }

}



TEST(FilterChain_i32, OneIirDynamicCalc) {

  fcb32_IirLowPass1 iir1;
  fcb32_IirLowPass1_new(&iir1);
  iir1.new_ratio = 0.3f;


  fc32_FilterChain filter_chain = { 0 };
  fcb32_GenericBlock* blocks[] = {
    &iir1.block,
  };
  filter_chain.blocks = &blocks[0];
  filter_chain.block_count = COUNT_OF(blocks);
  fc32_FilterChain_setup(&filter_chain);

  const int32_t input = 100;
  const int32_t error_tol = 1;
  int32_t expected;
  int32_t output = 0;
  int32_t difference;

  for (size_t i = 0; i < 50; i++)
  {
    int32_t last_output = output;
    difference = input - last_output;
    expected = (int32_t)(difference * iir1.new_ratio) + last_output;
    output = fc32_FilterChain_filter(&filter_chain, input);
    EXPECT_NEAR(expected, output, error_tol);
  }
}



int main(int argc, char** argv) {
  ::testing::InitGoogleMock(&argc, argv);
  int result = RUN_ALL_TESTS();
  return result;
}