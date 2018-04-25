#include "visitors.hpp"

void TestVisitorBridge_block_entered(fc_IVisitor* c_visitor, void* iblock)
{
  TestVisitorBridge* self = (TestVisitorBridge*)c_visitor;
  self->cpp_visitor->block_entered(iblock);
}


void TestVisitorBridge_block_exited(fc_IVisitor* c_visitor, void* iblock)
{
  TestVisitorBridge* self = (TestVisitorBridge*)c_visitor;
  self->cpp_visitor->block_exited(iblock);
}


//needed to ensure we can cast between parent c object and this one
TEST(TestVisitorBridge, ensure_standard_layout)
{
  TestVisitorBridge r;
  EXPECT_EQ(&r, (void*)&r.c_base);
}
