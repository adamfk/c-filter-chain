#pragma once

#include "fc_default_config.h"

#undef FILTER_CHAIN_TYPE
#undef FILTER_CHAIN_NAME_PREFIX

#define FILTER_CHAIN_NAME_PREFIX 32
#define FILTER_CHAIN_TYPE int32_t

#include "fc_template_root.h"

