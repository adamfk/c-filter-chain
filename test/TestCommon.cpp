#include "TestCommon.hpp"
#include "fc_lib/fc_macros.h"
#include "all_types.h"

//TODO remove
fc_BuildCtx test_malloc_builder = {
  &fc_Mallocator,
};


void TestCommon::test_iblock_constructed(void* iblock)
{
  SCOPED_TRACE(__func__);

  ASSERT_TRUE(is_ok_ptr(iblock));

  fc8_PassThrough* p = (fc8_PassThrough*)iblock;  //cast to any block that implements/extends IBlock
  ASSERT_EQ(p, (void*)&p->block); //must be true for polymorphism
  ASSERT_NE(p->block.vtable, nullptr);
}



TEST(NotABlock, mirrors_iblock) {
  fc8_PassThrough b8;
  fc8_PassThrough_ctor(&b8);
  NotABlock* nb = (NotABlock*)&b8;
  EXPECT_TRUE(sizeof(b8) == sizeof(nb));
  EXPECT_TRUE(sizeof(b8.block.vtable) == sizeof(nb->vtable));

  EXPECT_TRUE(sizeof(b8.block.vtable->step) == sizeof(nb->vtable->step));
  EXPECT_TRUE(sizeof(b8.block.vtable->preload) == sizeof(nb->vtable->preload));
  EXPECT_TRUE(sizeof(b8.block.vtable->destruct_fields) == sizeof(nb->vtable->destruct_fields));
  EXPECT_TRUE(sizeof(b8.block.vtable->run_visitor) == sizeof(nb->vtable->run_visitor));

  EXPECT_NE(b8.block.vtable->step, nullptr);
  EXPECT_NE(b8.block.vtable->preload, nullptr);
  EXPECT_NE(b8.block.vtable->destruct_fields, nullptr);
  EXPECT_NE(b8.block.vtable->run_visitor, nullptr);

  EXPECT_EQ((int)b8.block.vtable->step, (int)nb->vtable->step);
  EXPECT_EQ((int)b8.block.vtable->preload, (int)nb->vtable->preload);
  EXPECT_EQ((int)b8.block.vtable->destruct_fields, (int)nb->vtable->destruct_fields);
  EXPECT_EQ((int)b8.block.vtable->run_visitor, (int)nb->vtable->run_visitor);
}

