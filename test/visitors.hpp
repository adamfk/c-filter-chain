#pragma once

#include "fc_lib/fc_IVisitor.h"

#include "gmock/gmock.h"
#include "gtest/gtest.h"

//forward declarations

class TestVisitorBridge;
class ITestVisitor;



/**
 * C style visitor function that bridges to c++ visitor
 */
void TestVisitorBridge_block_entered(fc_IVisitor* c_visitor, void* iblock);
void TestVisitorBridge_block_exited(fc_IVisitor* c_visitor, void* iblock);


/**
 * !!! MUST be Standard Layout object to allow casting between c type and class
 * See http://en.cppreference.com/w/cpp/language/data_members#Standard_layout
 * 
 * Helps bridge c/c++ visitor interfaces
 */
class TestVisitorBridge
{
public:
  /**
   * !!!MUST!!! be first instance member for casting between this and fc_IVisitor interface
   */
  fc_IVisitor c_base;

  /**
   * c style vtable for fc_IVisitor interface.
   * Would normally be shared class/static data, but this is fine for testing.
   */
  fc_IVisitorVtable c_vtable;

  /**
   * The c++ visitor to bridge to the c visitor
   */
  ITestVisitor* cpp_visitor;

  TestVisitorBridge()
  {
    c_base.vtable = &c_vtable;
    c_vtable.block_entered = TestVisitorBridge_block_entered;
    c_vtable.block_exited = TestVisitorBridge_block_exited;
  }
};



class ITestVisitor
{
  TestVisitorBridge c_bridge;
public:
  
  ITestVisitor()
  {
    c_bridge.cpp_visitor = this;
  }

  virtual ~ITestVisitor() {}
  virtual void block_entered(void* iblock) {}
  virtual void block_exited(void* iblock) {}

  //allow passing c++ object to c code with below implicit conversion
  operator fc_IVisitor* () { return &c_bridge.c_base; }
};




class MockVisitor : public ITestVisitor {

public:
  MOCK_METHOD1(block_entered, void(void* iblock));
  MOCK_METHOD1(block_exited, void(void* iblock));
};


