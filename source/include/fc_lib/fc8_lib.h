#pragma once

#include "fc_default_config.h"

#undef FILTER_CHAIN_TYPE
#undef FILTER_CHAIN_NAME_PREFIX

#define FILTER_CHAIN_NAME_PREFIX 8
#define FILTER_CHAIN_TYPE int8_t

#include "fc_lib/templates/fc_template_root.h"

