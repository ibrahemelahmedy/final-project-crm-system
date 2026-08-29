// The ONLY public surface of this feature. Story 04 imports from here and
// nothing deeper.
export { CustomersPage } from './pages/CustomersPage';
export { CustomerProfilePage } from './pages/CustomerProfilePage';
export type { Customer } from './model/customer';
export { useCustomerSearch } from './hooks/useCustomerSearch';
export { useCustomer } from './hooks/useCustomer';
export { customerKeys } from './api/queryKeys';
