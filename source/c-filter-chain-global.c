
/**
 * This is a special pointer value to indicate an allocation failure.
 * The lib uses NULL to terminate lists and needs this special pointer
 * value to be able to detect a nested allocation failure.
 */
void const * const CF_ALLOCATE_FAIL_PTR = &(int) {2};
