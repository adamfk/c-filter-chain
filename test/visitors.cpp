#include "visitors.hpp"

void TestVisitorBridge_visit(fc_IVisitor* c_visitor, void* iblock)
{
  TestVisitorBridge* self = (TestVisitorBridge*)c_visitor;
  self->cpp_visitor->visit(iblock);
}


//needed to ensure we can cast between parent c object and this one
TEST(TestVisitorBridge, ensure_standard_layout)
{
  TestVisitorBridge r;
  EXPECT_EQ(&r, (void*)&r.c_base);
}
