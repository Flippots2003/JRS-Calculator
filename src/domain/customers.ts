import type { Customer } from './models'

// Keep the existing storage format so old customers, quotes and backups still work.
export function customerAddress(customer: Customer) {
  return [customer.street, [customer.postcode, customer.city].filter(Boolean).join(' ')].filter(Boolean).join('\n')
}
export function customerLabel(customer: Customer) {
  return customer.name.trim() || customerAddress(customer).trim().split('\n')[0] || customer.phone.trim() || customer.vatNumber.trim() || 'Zonder klantgegevens'
}
export function hasCustomerDetails(customer: Customer) {
  return [customer.name, customer.street, customer.postcode, customer.city, customer.phone, customer.vatNumber, customer.contact, customer.email, customer.notes, customer.executionAddress].some(value => value.trim())
}
