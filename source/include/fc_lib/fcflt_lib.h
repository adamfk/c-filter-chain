#pragma once

#include "fc_default_config.h"

#undef fc_PTYPE
#undef fc_LIB_PREFIX

#define fc_LIB_PREFIX flt
#define fc_PTYPE float

#include "fc_lib/templates/fc_template_root.h"
