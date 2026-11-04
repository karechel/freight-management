// Customer and contact form rules. They give quick feedback in the browser; the backend
// repeats every check, because browser checks can be bypassed.

import type { CustomerContact, CustomerDetail } from './customers';
import type { FieldErrors } from './validation';
import type { AccountStatus } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]{5,18}[0-9]$/;
const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export interface CustomerFormValues {
  name: string;
  legalName: string;
  kraPin: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  notes: string;
  paymentTermsDays: string;
  creditLimit: string;
  accountStatus: AccountStatus;
}

export type CustomerField = keyof CustomerFormValues;

export const customerFieldLabels: Record<CustomerField, string> = {
  name: 'Company name',
  legalName: 'Registered legal name',
  kraPin: 'KRA PIN',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  city: 'City or town',
  country: 'Country',
  notes: 'Notes',
  paymentTermsDays: 'Payment terms (days)',
  creditLimit: 'Credit limit (KES)',
  accountStatus: 'Account status',
};

export interface CustomerFormAccess {
  details: boolean;
  billing: boolean;
  status: boolean;
}

export function customerFormValues(customer?: CustomerDetail): CustomerFormValues {
  return {
    name: customer?.name ?? '',
    legalName: customer?.legalName ?? '',
    kraPin: customer?.kraPin ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    city: customer?.city ?? '',
    country: customer?.country ?? 'KE',
    notes: customer?.notes ?? '',
    paymentTermsDays: customer?.billing?.paymentTermsDays?.toString() ?? '',
    creditLimit: customer?.billing?.creditLimit ?? '',
    accountStatus: customer?.accountStatus ?? 'active',
  };
}

export type CustomerInput = Record<string, string | number | null>;

/** Checks only the sections this user can change, and sends only those to the backend. */
export function validateCustomerForm(values: CustomerFormValues, access: CustomerFormAccess) {
  const errors: FieldErrors<CustomerField> = {};
  const input: CustomerInput = {};

  if (access.details) {
    if (!values.name.trim()) errors.name = 'Enter the company name.';
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (values.phone.trim() && !PHONE_PATTERN.test(values.phone.trim())) {
      errors.phone = 'Enter a valid phone number.';
    }
    Object.assign(input, {
      name: values.name.trim(),
      legalName: values.legalName.trim(),
      kraPin: values.kraPin.trim().toUpperCase(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      city: values.city.trim(),
      country: values.country.trim(),
      notes: values.notes.trim(),
    });
  }

  if (access.billing) {
    const terms = values.paymentTermsDays.trim();
    const limit = values.creditLimit.trim();
    if (terms && (!/^\d+$/.test(terms) || Number(terms) > 365)) {
      errors.paymentTermsDays = 'Enter a whole number of days from 0 to 365.';
    }
    if (limit && !MONEY_PATTERN.test(limit)) {
      errors.creditLimit = 'Enter an amount of zero or more, with up to two decimal places and no commas.';
    }
    Object.assign(input, {
      paymentTermsDays: terms ? Number(terms) : null,
      creditLimit: limit || null,
    });
  }

  if (access.status) input.accountStatus = values.accountStatus;

  return { errors, input: Object.keys(errors).length === 0 ? input : undefined };
}

export interface ContactFormValues {
  name: string;
  title: string;
  email: string;
  phone: string;
}

export type ContactField = keyof ContactFormValues;

export const contactFieldLabels: Record<ContactField, string> = {
  name: 'Name',
  title: 'Job title',
  email: 'Email',
  phone: 'Phone',
};

export const contactFormValues = (contact?: CustomerContact): ContactFormValues => ({
  name: contact?.name ?? '',
  title: contact?.title ?? '',
  email: contact?.email ?? '',
  phone: contact?.phone ?? '',
});

export function validateContactForm(values: ContactFormValues) {
  const errors: FieldErrors<ContactField> = {};
  const input = {
    name: values.name.trim(),
    title: values.title.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
  };
  if (!input.name) errors.name = 'Enter the contact’s name.';
  if (input.email && !EMAIL_PATTERN.test(input.email)) errors.email = 'Enter a valid email address.';
  if (input.phone && !PHONE_PATTERN.test(input.phone)) errors.phone = 'Enter a valid phone number.';
  return { errors, input: Object.keys(errors).length === 0 ? input : undefined };
}
