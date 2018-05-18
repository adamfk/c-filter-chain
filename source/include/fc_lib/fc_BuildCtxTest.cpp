#include "gmock/gmock.h"
#include "gtest/gtest.h"

#include "fc_lib/fc_BuildCtx.h"
#include "fc_allocate.h"

#include <functional>
using ::std::function;

#include <vector>
using ::std::vector;


namespace {

TEST(BuildCtx, update_minimum_working_buffer__ensure_only_grows) {
  fc_BuildCtx build_ctx = { 0 };
  fc_WorkingBuffer wb = { 0 };
  fc_BuildCtx* bc = &build_ctx;
  bc->working_buffer = &wb;

  EXPECT_EQ(bc->min_working_buffer_size, 0);

  fc_BuildCtx_update_minimum_working_buffer(bc, 10);
  EXPECT_EQ(bc->min_working_buffer_size, 10);

  fc_BuildCtx_update_minimum_working_buffer(bc, 5);
  EXPECT_EQ(bc->min_working_buffer_size, 10);

  fc_BuildCtx_update_minimum_working_buffer(bc, 17);
  EXPECT_EQ(bc->min_working_buffer_size, 17);
}




const vector<function<void(fc_BuildCtx* bc)>> non_failure_marking_functions = {
  [=](fc_BuildCtx* bc) {
    fc_BuildCtx_update_success(bc, true);
  },
  [=](fc_BuildCtx* bc) {
    fc_BuildCtx_update_failure(bc, false);
  },
  [=](fc_BuildCtx* bc) {
    int some_obj = 0;
    void* ok_ptr = &some_obj;         //just any OK ptr
    ASSERT_TRUE(is_ok_ptr(ok_ptr));
    fc_BuildCtx_update_success_from_ptr(bc, ok_ptr);
  },
};


const vector<function<void(fc_BuildCtx* bc)>> failure_marking_functions = {
  [=](fc_BuildCtx* bc) {
    fc_BuildCtx_update_success(bc, false);
  },
  [=](fc_BuildCtx* bc) {
    fc_BuildCtx_update_failure(bc, true);
  },
  [=](fc_BuildCtx* bc) {
    fc_BuildCtx_update_success_from_ptr(bc, NULL);
  },
  [=](fc_BuildCtx* bc) {
    fc_BuildCtx_update_success_from_ptr(bc, fc_ALLOCATE_FAIL_PTR);
  },
};


static void run_non_failure_marking_functions(fc_BuildCtx* bc, bool expected_has_failure_value) {
  for (auto func : non_failure_marking_functions) {
    func(bc);
    EXPECT_EQ(fc_BuildCtx_has_failure(bc), expected_has_failure_value);
  }
}


static void run_failure_marking_functions(fc_BuildCtx* bc, bool expected_has_failure_value) {
  for (auto func : failure_marking_functions) {
    func(bc);
    EXPECT_EQ(fc_BuildCtx_has_failure(bc), expected_has_failure_value);
  }
}




static void ensure_error_sticky(fc_BuildCtx* bc) {
  bool expected_has_failure_value = true;
  run_non_failure_marking_functions(bc, expected_has_failure_value);
  run_failure_marking_functions(bc, expected_has_failure_value);
}


TEST(BuildCtx, one_or_more_failures__flag) {

  for (auto fail_marking_func : failure_marking_functions) {
    fc_BuildCtx build_ctx = { 0 };
    fc_BuildCtx* bc = &build_ctx;
    bool expected_has_failure_value;

    expected_has_failure_value = false;
    run_non_failure_marking_functions(bc, expected_has_failure_value);
    EXPECT_EQ(fc_BuildCtx_has_failure(bc), expected_has_failure_value);

    expected_has_failure_value = true;
    fail_marking_func(bc);
    EXPECT_EQ(fc_BuildCtx_has_failure(bc), expected_has_failure_value);

    ensure_error_sticky(bc);
  }
}







} //end of namespace
