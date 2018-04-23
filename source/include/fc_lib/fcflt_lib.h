#pragma once

#include "fc_default_config.h"

#undef FILTER_CHAIN_TYPE
#undef FILTER_CHAIN_NAME_PREFIX

#define FILTER_CHAIN_NAME_PREFIX flt
#define FILTER_CHAIN_TYPE float

#include "fc_lib/templates/fc_template_root.h"

